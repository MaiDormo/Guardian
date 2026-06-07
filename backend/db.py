"""
db.py — SQLite + sqlite-vec database layer.

IMPORTANT: get_conn() is the only public entry point. It is LAZY — never called
at module import time. Call it from inside process_event() only, so that a
failing extension load or missing file never blocks the HAS_TANMAY import gate.

sqlite-vec landmine: Python's stdlib sqlite3 is often compiled without
loadable-extension support. enable_load_extension() may raise AttributeError
(not OperationalError) before sqlite_vec.load() is reached. Both calls live in
the same try/except.
"""

import json
import logging
import os
import sqlite3
from typing import Optional

log = logging.getLogger(__name__)

_conn: Optional[sqlite3.Connection] = None
VEC_AVAILABLE: bool = False

# ---------------------------------------------------------------------------
# Schema DDL
# ---------------------------------------------------------------------------

_BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT    NOT NULL,
    source      TEXT    NOT NULL,
    room        TEXT,
    timestamp   TEXT    NOT NULL,
    confidence  REAL    NOT NULL DEFAULT 1.0,
    payload     TEXT    NOT NULL DEFAULT '{}',
    dedup_key   TEXT    NOT NULL UNIQUE,
    seq         INTEGER NOT NULL DEFAULT 0,
    ingested_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_ingested ON events(ingested_at);

CREATE TABLE IF NOT EXISTS signals (
    signal          TEXT PRIMARY KEY,
    state           TEXT NOT NULL DEFAULT 'unknown',
    reason          TEXT NOT NULL DEFAULT '',
    cosine_distance REAL,
    updated_at      TEXT,
    amber_since     TEXT
);

CREATE TABLE IF NOT EXISTS locations (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp                TEXT NOT NULL,
    lat                      REAL NOT NULL,
    lng                      REAL NOT NULL,
    distance_from_home_m     INTEGER,
    trajectory_density_score REAL,
    baseline_cluster_match   INTEGER,
    cluster_id               INTEGER
);
CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp);

CREATE TABLE IF NOT EXISTS voice_checkins (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp                 TEXT NOT NULL,
    speech_rate_wpm           INTEGER,
    clarity_score             REAL,
    sentiment                 TEXT,
    confusion_markers         INTEGER,
    response_latency_s        REAL,
    duration_s                INTEGER,
    baseline_deviation_cosine REAL
);
CREATE INDEX IF NOT EXISTS idx_voice_checkins_timestamp ON voice_checkins(timestamp);

CREATE TABLE IF NOT EXISTS baselines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    day        TEXT NOT NULL,
    signal     TEXT,
    summary    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_day_signal ON baselines(day, COALESCE(signal, ''));

CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    signal     TEXT,
    payload    TEXT NOT NULL DEFAULT '{}',
    dispatched INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alerts_created_dispatched ON alerts(created_at, dispatched);
"""

_VEC_TABLE = """
CREATE VIRTUAL TABLE IF NOT EXISTS vec_baselines USING vec0(
    baseline_id INTEGER PRIMARY KEY,
    embedding   FLOAT[768]
);
"""

# ---------------------------------------------------------------------------
# Connection + init
# ---------------------------------------------------------------------------


def get_conn() -> sqlite3.Connection:
    """Return (or lazily create) the singleton SQLite connection."""
    global _conn, VEC_AVAILABLE
    if _conn is not None:
        return _conn

    path = os.getenv("DB_PATH", "./guardian.db")
    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA wal_autocheckpoint=1000")
    _conn.execute("PRAGMA busy_timeout=5000")
    _conn.execute("PRAGMA foreign_keys=ON")

    _init_schema(_conn)
    VEC_AVAILABLE = _load_vec(_conn)
    return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_BASE_SCHEMA)
    conn.commit()


def _load_vec(conn: sqlite3.Connection) -> bool:
    """Load sqlite-vec extension. Returns True on success, False on any failure."""
    try:
        conn.enable_load_extension(True)   # raises AttributeError on stripped builds
        import sqlite_vec                   # noqa: PLC0415
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        conn.executescript(_VEC_TABLE)
        conn.commit()
        log.info("sqlite-vec loaded ✓  vec_baselines table ready")
        return True
    except (AttributeError, sqlite3.OperationalError, ImportError, Exception) as exc:
        log.warning("sqlite-vec unavailable (%s) — cosine will use numpy fallback", exc)
        try:
            conn.enable_load_extension(False)
        except Exception:
            pass
        return False


def reset_connection() -> None:
    """Close and clear the cached connection (used between test scenarios)."""
    global _conn, VEC_AVAILABLE
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None
        VEC_AVAILABLE = False
