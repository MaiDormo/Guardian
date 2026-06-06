"""
location.py — GPS trajectory processing and wandering detection.

For the demo, trajectory_density_score and baseline_cluster_match are
pre-baked in the simulator events and passed through directly. DBSCAN
computation is available as a stretch for live GPS data.

process_location(event) → raw SSE envelopes (location_update or wandering_detected).
Signal-level logic (location green/amber/red) lives in signals.update_signal_state.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from config import LOCATION_DENSITY_AMBER, WANDER_MIN_MINUTES

log = logging.getLogger(__name__)


def process_location(event: dict) -> list[dict]:
    """
    Return raw SSE envelopes for location_update and wandering_detected events.

    location_update → [location_update SSE]      (fallback-identical shape: {**payload, updated_at})
    wandering_detected → [wandering_detected SSE] (same passthrough shape)
    """
    et: str = event.get("event_type") or ""
    payload: dict = event.get("payload") or {}
    now: str = event.get("timestamp") or _ts()

    sse_out: list[dict] = []

    if et == "location_update":
        # Fallback-identical: pass through all payload fields + updated_at
        sse_out.append({
            "event": "location_update",
            "payload": {**payload, "updated_at": now},
        })
        _persist_location(payload, now)

    elif et == "wandering_detected":
        sse_out.append({
            "event": "wandering_detected",
            "payload": {**payload, "updated_at": now},
        })
        _persist_location(payload, now)
        _write_wandering_alert(payload, now)

    return sse_out


def is_wandering(
    density: float,
    cluster_match: bool,
    minutes_outside: int,
) -> bool:
    """
    PRD §5.2 wandering definition: trajectory breaks all baseline clusters
    AND density score below threshold AND stationary/unknown >30min outside footprint.
    """
    return (
        not cluster_match
        and density < LOCATION_DENSITY_AMBER
        and minutes_outside > WANDER_MIN_MINUTES
    )


def fit_baseline_clusters(points: list[tuple[float, float]]):
    """
    Fit DBSCAN on (lat, lng) pairs. Returns fitted DBSCAN instance.
    eps≈0.0015 ≈ 150m, min_samples=5.
    Pre-baked from gps_normal.json for the demo.
    """
    try:
        from sklearn.cluster import DBSCAN  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415

        coords = np.array(points)
        db = DBSCAN(eps=0.0015, min_samples=5, metric="euclidean")
        db.fit(coords)
        return db
    except Exception as exc:
        log.warning("fit_baseline_clusters failed (%s)", exc)
        return None


# ---------------------------------------------------------------------------
# DB persistence (best-effort — never raises)
# ---------------------------------------------------------------------------


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _persist_location(payload: dict, timestamp: str) -> None:
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        conn.execute(
            """INSERT INTO locations
               (timestamp, lat, lng, distance_from_home_m,
                trajectory_density_score, baseline_cluster_match, cluster_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                timestamp,
                payload.get("lat"),
                payload.get("lng"),
                payload.get("distance_from_home_m"),
                payload.get("trajectory_density_score"),
                1 if payload.get("baseline_cluster_match") else 0,
                None,
            ),
        )
        conn.commit()
    except Exception as exc:
        log.debug("_persist_location failed (%s)", exc)


def _write_wandering_alert(payload: dict, timestamp: str) -> None:
    import json  # noqa: PLC0415
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        conn.execute(
            """INSERT INTO alerts (alert_type, signal, payload, dispatched, created_at)
               VALUES (?, ?, ?, 0, ?)""",
            ("wandering", "location", json.dumps(payload), timestamp),
        )
        conn.commit()
    except Exception as exc:
        log.debug("_write_wandering_alert failed (%s)", exc)
