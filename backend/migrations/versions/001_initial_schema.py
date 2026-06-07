"""Initial Guardian schema — events, signals, locations, voice, baselines, alerts.

Revision ID: 001
Revises:
Create Date: 2026-06-07

"""
from typing import Sequence, Union

from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SIGNAL_NAMES = (
    "woke_up",
    "ate",
    "took_meds",
    "rested_well",
    "helper_present",
    "voice_checkin",
    "location",
    "routine",
)


def upgrade() -> None:
    op.execute(
        """
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
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, timestamp)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_events_ingested ON events(ingested_at)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS signals (
            signal          TEXT PRIMARY KEY,
            state           TEXT NOT NULL DEFAULT 'unknown',
            reason          TEXT NOT NULL DEFAULT '',
            cosine_distance REAL,
            updated_at      TEXT,
            amber_since     TEXT
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS locations (
            id                       INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp                TEXT NOT NULL,
            lat                      REAL NOT NULL,
            lng                      REAL NOT NULL,
            distance_from_home_m     INTEGER,
            trajectory_density_score REAL,
            baseline_cluster_match   INTEGER,
            cluster_id               INTEGER
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_locations_timestamp ON locations(timestamp)"
    )

    op.execute(
        """
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
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_voice_checkins_timestamp ON voice_checkins(timestamp)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS baselines (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            day        TEXT NOT NULL,
            signal     TEXT,
            summary    TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_day_signal "
        "ON baselines(day, COALESCE(signal, ''))"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            signal     TEXT,
            payload    TEXT NOT NULL DEFAULT '{}',
            dispatched INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_alerts_created_dispatched "
        "ON alerts(created_at, dispatched)"
    )

    bind = op.get_bind()
    for name in SIGNAL_NAMES:
        bind.exec_driver_sql(
            "INSERT OR IGNORE INTO signals (signal, state, reason) VALUES (?, 'unknown', '')",
            (name,),
        )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS alerts")
    op.execute("DROP TABLE IF EXISTS baselines")
    op.execute("DROP TABLE IF EXISTS voice_checkins")
    op.execute("DROP TABLE IF EXISTS locations")
    op.execute("DROP TABLE IF EXISTS signals")
    op.execute("DROP TABLE IF EXISTS events")
