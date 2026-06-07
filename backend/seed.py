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
_VOICE_NORMAL = _DATA_DIR / "voice_normal.json"


def seed_all() -> None:
    """Run all seeders. Safe to call multiple times (INSERT OR IGNORE)."""
    log.info("seed.py: seeding 30-day baseline…")
    seed_gps_baseline()
    seed_voice_baseline()
    seed_signal_summaries()
    seed_connection_baseline()
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


def seed_voice_baseline() -> None:
    """Load voice_normal.json into voice_checkins (fixed May 2026 window)."""
    if not _VOICE_NORMAL.exists():
        log.warning("voice_normal.json not found at %s — skipping voice seed", _VOICE_NORMAL)
        return

    try:
        with open(_VOICE_NORMAL) as f:
            data = json.load(f)
    except Exception as exc:
        log.warning("Failed to load voice_normal.json (%s)", exc)
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
                    """INSERT OR IGNORE INTO voice_checkins
                       (timestamp, speech_rate_wpm, clarity_score, sentiment,
                        confusion_markers, response_latency_s, duration_s,
                        baseline_deviation_cosine)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        evt.get("timestamp"),
                        payload.get("speech_rate_wpm"),
                        payload.get("clarity_score"),
                        payload.get("sentiment"),
                        1 if payload.get("confusion_markers") else 0,
                        payload.get("response_latency_s"),
                        payload.get("duration_s"),
                        0.04,
                    ),
                )
                inserted += 1
            except Exception:
                pass
        conn.commit()
        log.info("seed_voice_baseline: inserted %d voice check-ins", inserted)
    except Exception as exc:
        log.warning("seed_voice_baseline failed (%s)", exc)


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


def seed_connection_baseline() -> None:
    """
    Seed 14 days of hourly presence events and voice check-ins so that
    connection.py's SQL queries return meaningful results from day one.

    Daily rhythm:
      07:00-09:00  bedroom → kitchen (morning routine)
      10:00-11:00  living_room (helper / quiet)
      13:00-14:00  kitchen (lunch)
      15:00-17:00  living_room (peak calm window — highest voice clarity)
      19:00-20:00  living_room (evening quiet)

    Voice check-ins: one per day at 09:30, clarity peaks in the afternoon
    pattern used by connection.py's _voice_quality_by_hour().
    """
    try:
        sys.path.insert(0, str(_BACKEND_DIR))
        from db import get_conn  # noqa: PLC0415
        import hashlib  # noqa: PLC0415

        conn = get_conn()
        today = datetime.now(timezone.utc).date()

        # (hour, room, dwell_s)
        DAILY_PRESENCE: list[tuple[int, str, int]] = [
            (7,  "bedroom",      0),
            (8,  "kitchen",   1320),
            (10, "living_room",  0),
            (11, "living_room",  0),
            (13, "kitchen",    900),
            (15, "living_room",  0),
            (16, "living_room",  0),
            (19, "living_room",  0),
        ]

        # hour → (clarity_score, sentiment)  — afternoon is clearest
        VOICE_QUALITY_BY_HOUR: dict[int, tuple[float, str]] = {
            9:  (0.87, "positive"),
            15: (0.88, "positive"),
            16: (0.86, "positive"),
        }

        events_inserted = 0
        voice_inserted = 0

        for days_back in range(14, 0, -1):
            day_date = today - timedelta(days=days_back)

            for hour, room, dwell_s in DAILY_PRESENCE:
                ts = datetime(
                    day_date.year, day_date.month, day_date.day,
                    hour, 15, 0, tzinfo=timezone.utc,
                ).isoformat()

                # Stable dedup key so INSERT OR IGNORE is truly idempotent
                dedup = hashlib.sha1(
                    f"seed:presence:{day_date}:{hour}:{room}".encode()
                ).hexdigest()[:16]

                import json as _json  # noqa: PLC0415
                try:
                    conn.execute(
                        """INSERT OR IGNORE INTO events
                           (event_type, source, room, timestamp, confidence,
                            payload, dedup_key, seq, ingested_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            "presence_detected",
                            "mmwave_ld2410",
                            room,
                            ts,
                            0.97,
                            _json.dumps({"targets": 1, "dwell_s": dwell_s, "motion": "stationary"}),
                            dedup,
                            0,
                            datetime.now(timezone.utc).isoformat(),
                        ),
                    )
                    events_inserted += 1
                except Exception:
                    pass

            # One voice check-in per day at 09:30
            checkin_ts = datetime(
                day_date.year, day_date.month, day_date.day,
                9, 30, 0, tzinfo=timezone.utc,
            ).isoformat()

            # Vary clarity slightly day to day for realism
            clarity = round(0.85 + (days_back % 3) * 0.01, 2)
            sentiment = "positive" if days_back % 5 != 0 else "neutral"

            try:
                conn.execute(
                    """INSERT OR IGNORE INTO voice_checkins
                       (timestamp, speech_rate_wpm, clarity_score, sentiment,
                        confusion_markers, response_latency_s, duration_s,
                        baseline_deviation_cosine)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (checkin_ts, 136, clarity, sentiment, 0, 1.3, 140, 0.04),
                )
                voice_inserted += 1
            except Exception:
                pass

        conn.commit()
        log.info(
            "seed_connection_baseline: %d presence events, %d voice check-ins",
            events_inserted,
            voice_inserted,
        )
    except Exception as exc:
        log.warning("seed_connection_baseline failed (%s)", exc)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [seed] %(message)s")
    os.chdir(_BACKEND_DIR)
    seed_all()
