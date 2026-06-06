"""
seed.py — 30-day baseline preloader.

Seeds the DB with GPS history (for DBSCAN clusters) and synthetic baseline
summaries (for cold-start bypass and routine cosine comparisons) so the
30-day pre-loaded demo state is available from first dashboard open.

Usage:
  python3 -m backend.seed           # standalone (run from repo root)
  python3 seed.py                   # run from backend/ directory
  seed_all()                        # called from lifespan hook in main.py

Coordinate with Elia: the lifespan hook should call seed_all() on startup.
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

log = logging.getLogger(__name__)

# Resolve paths relative to this file so it works from any CWD
_BACKEND_DIR = Path(__file__).parent
_DATA_DIR = _BACKEND_DIR.parent / "data" / "synthetic"
_GPS_NORMAL = _DATA_DIR / "gps_normal.json"


def seed_all() -> None:
    """Run all seeders. Safe to call multiple times (INSERT OR IGNORE)."""
    log.info("seed.py: seeding 30-day baseline…")
    seed_gps_baseline()
    seed_signal_summaries()
    log.info("seed.py: done.")


def seed_gps_baseline() -> None:
    """Load gps_normal.json into the locations table for DBSCAN clusters."""
    if not _GPS_NORMAL.exists():
        log.warning("gps_normal.json not found at %s — skipping GPS seed", _GPS_NORMAL)
        return

    try:
        with open(_GPS_NORMAL) as f:
            data = json.load(f)
    except Exception as exc:
        log.warning("Failed to load gps_normal.json (%s)", exc)
        return

    try:
        sys.path.insert(0, str(_BACKEND_DIR))
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()

        inserted = 0
        for evt in data.get("events", []):
            payload = evt.get("payload", {})
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO locations
                       (timestamp, lat, lng, distance_from_home_m,
                        trajectory_density_score, baseline_cluster_match, cluster_id)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        evt.get("timestamp"),
                        payload.get("lat"),
                        payload.get("lng"),
                        payload.get("distance_from_home_m"),
                        payload.get("trajectory_density_score"),
                        1 if payload.get("baseline_cluster_match") else 0,
                        0,  # cluster 0 = home cluster
                    ),
                )
                inserted += 1
            except Exception:
                pass
        conn.commit()
        log.info("seed_gps_baseline: inserted %d GPS points", inserted)
    except Exception as exc:
        log.warning("seed_gps_baseline failed (%s)", exc)


def seed_signal_summaries() -> None:
    """
    Insert 30 synthetic daily summary rows into the baselines table.
    These represent normal-day behavioural patterns so COLD_START_DAYS is
    satisfied immediately at demo time.
    """
    try:
        sys.path.insert(0, str(_BACKEND_DIR))
        from db import get_conn  # noqa: PLC0415

        conn = get_conn()
        today = datetime.now(timezone.utc).date()
        inserted = 0

        for days_back in range(30, 0, -1):
            day = (today - timedelta(days=days_back)).isoformat()
            summary = (
                f"Normal day {day}: bedroom wake 07:20, kitchen breakfast 08:00 "
                f"dwell 22min, dispenser opened, helper visit 10:00, "
                f"voice check-in nominal, GPS home cluster, cosine 0.04"
            )
            try:
                conn.execute(
                    "INSERT OR IGNORE INTO baselines (day, signal, summary, created_at) "
                    "VALUES (?, NULL, ?, ?)",
                    (day, summary, datetime.now(timezone.utc).isoformat()),
                )
                inserted += 1
            except Exception:
                pass

        conn.commit()
        log.info("seed_signal_summaries: inserted %d day summaries", inserted)
    except Exception as exc:
        log.warning("seed_signal_summaries failed (%s)", exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [seed] %(message)s")
    os.chdir(_BACKEND_DIR)
    seed_all()
