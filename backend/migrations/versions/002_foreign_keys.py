"""Add foreign keys and orphan-prevention triggers.

Revision ID: 002
Revises: 001
Create Date: 2026-06-07

SQLite requires table rebuilds to add FK constraints to existing tables.
vec_baselines is a sqlite-vec virtual table — FK not supported; use a trigger
on baselines DELETE instead.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    row = bind.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": name},
    ).fetchone()
    return row is not None


def _fk_already_applied() -> bool:
    if not _table_exists("alerts"):
        return False
    bind = op.get_bind()
    rows = bind.execute(text("PRAGMA foreign_key_list(alerts)")).fetchall()
    return any(r[2] == "signals" for r in rows)


def upgrade() -> None:
    if _fk_already_applied():
        return

    # Sanitize orphan signal references before adding constraints.
    op.execute(
        "UPDATE alerts SET signal = NULL "
        "WHERE signal IS NOT NULL "
        "AND signal NOT IN (SELECT signal FROM signals)"
    )
    op.execute(
        "UPDATE baselines SET signal = NULL "
        "WHERE signal IS NOT NULL "
        "AND signal NOT IN (SELECT signal FROM signals)"
    )

    op.execute("PRAGMA foreign_keys=OFF")

    # ── alerts: signal → signals.signal ─────────────────────────────────────
    op.execute(
        """
        CREATE TABLE alerts_new (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            signal     TEXT REFERENCES signals(signal) ON DELETE SET NULL,
            payload    TEXT NOT NULL DEFAULT '{}',
            dispatched INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "INSERT INTO alerts_new (id, alert_type, signal, payload, dispatched, created_at) "
        "SELECT id, alert_type, signal, payload, dispatched, created_at FROM alerts"
    )
    op.execute("DROP TABLE alerts")
    op.execute("ALTER TABLE alerts_new RENAME TO alerts")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_alerts_created_dispatched "
        "ON alerts(created_at, dispatched)"
    )

    # ── baselines: signal → signals.signal (nullable day summaries) ─────────
    op.execute(
        """
        CREATE TABLE baselines_new (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            day        TEXT NOT NULL,
            signal     TEXT REFERENCES signals(signal) ON DELETE SET NULL,
            summary    TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "INSERT INTO baselines_new (id, day, signal, summary, created_at) "
        "SELECT id, day, signal, summary, created_at FROM baselines"
    )
    op.execute("DROP TABLE baselines")
    op.execute("ALTER TABLE baselines_new RENAME TO baselines")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_day_signal "
        "ON baselines(day, COALESCE(signal, ''))"
    )

    # vec_baselines (sqlite-vec virtual table) cannot use FK — trigger installed
    # in db._ensure_vec_orphan_trigger() after the extension loads.

    op.execute("PRAGMA foreign_keys=ON")


def downgrade() -> None:
    if not _table_exists("alerts"):
        return

    op.execute("PRAGMA foreign_keys=OFF")

    op.execute(
        """
        CREATE TABLE alerts_old (
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
        "INSERT INTO alerts_old SELECT * FROM alerts"
    )
    op.execute("DROP TABLE alerts")
    op.execute("ALTER TABLE alerts_old RENAME TO alerts")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_alerts_created_dispatched "
        "ON alerts(created_at, dispatched)"
    )

    op.execute(
        """
        CREATE TABLE baselines_old (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            day        TEXT NOT NULL,
            signal     TEXT,
            summary    TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    op.execute(
        "INSERT INTO baselines_old SELECT * FROM baselines"
    )
    op.execute("DROP TABLE baselines")
    op.execute("ALTER TABLE baselines_old RENAME TO baselines")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_day_signal "
        "ON baselines(day, COALESCE(signal, ''))"
    )

    op.execute("PRAGMA foreign_keys=ON")
