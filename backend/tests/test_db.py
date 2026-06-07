"""
Database resilience tests — migrations, foreign keys, backup/restore.
"""

import os
import sqlite3
from pathlib import Path

import pytest

from backup import create_backup, list_backups, restore_backup, vacuum_database
from db import current_schema_revision, db_file_path, get_conn, reset_connection


@pytest.fixture
def isolated_db(tmp_path, monkeypatch):
    """Fresh SQLite file per test — migrations run on first get_conn()."""
    db_file = tmp_path / "test_guardian.db"
    monkeypatch.setenv("DB_PATH", str(db_file))
    reset_connection()
    yield db_file
    reset_connection()


def test_migrations_apply_to_head(isolated_db):
    get_conn()
    assert current_schema_revision() == "002"


def test_all_core_tables_exist(isolated_db):
    conn = get_conn()
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
    }
    assert {
        "events",
        "signals",
        "locations",
        "voice_checkins",
        "baselines",
        "alerts",
        "alembic_version",
    } <= tables


def test_signals_catalog_seeded(isolated_db):
    conn = get_conn()
    rows = conn.execute("SELECT signal FROM signals ORDER BY signal").fetchall()
    names = {r[0] for r in rows}
    assert names == {
        "woke_up",
        "ate",
        "took_meds",
        "rested_well",
        "helper_present",
        "voice_checkin",
        "location",
        "routine",
    }


def test_alerts_rejects_invalid_signal_fk(isolated_db):
    conn = get_conn()
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            """INSERT INTO alerts (alert_type, signal, payload, dispatched, created_at)
               VALUES ('test', 'not_a_real_signal', '{}', 0, '2026-06-07T00:00:00Z')"""
        )


def test_alerts_accepts_null_signal(isolated_db):
    conn = get_conn()
    conn.execute(
        """INSERT INTO alerts (alert_type, signal, payload, dispatched, created_at)
           VALUES ('fall', NULL, '{}', 0, '2026-06-07T00:00:00Z')"""
    )
    conn.commit()


def test_baselines_rejects_invalid_signal_fk(isolated_db):
    conn = get_conn()
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            """INSERT INTO baselines (day, signal, summary, created_at)
               VALUES ('2026-06-01', 'bogus_signal', 'summary', '2026-06-07T00:00:00Z')"""
        )


def test_baselines_null_signal_allowed(isolated_db):
    conn = get_conn()
    conn.execute(
        """INSERT INTO baselines (day, signal, summary, created_at)
           VALUES ('2026-06-01', NULL, 'day summary', '2026-06-07T00:00:00Z')"""
    )
    conn.commit()


def test_backup_and_restore_roundtrip(isolated_db, tmp_path, monkeypatch):
    conn = get_conn()
    conn.execute(
        """INSERT INTO events
           (event_type, source, room, timestamp, confidence, payload,
            dedup_key, seq, ingested_at)
           VALUES ('ping', 'test', NULL, '2026-06-07T00:00:00Z', 1.0, '{}',
                   'dedup-test-1', 0, '2026-06-07T00:00:00Z')"""
    )
    conn.commit()
    reset_connection()

    backup_path = create_backup(tmp_path / "snap.db")
    assert backup_path.exists()

    # Wipe live DB
    isolated_db.unlink()
    reset_connection()

    restore_backup(backup_path, confirm=True)
    reset_connection()

    conn = get_conn()
    count = conn.execute("SELECT COUNT(*) FROM events WHERE dedup_key = 'dedup-test-1'").fetchone()[0]
    assert count == 1


def test_vacuum_runs_without_error(isolated_db):
    get_conn()
    reset_connection()
    vacuum_database()
    assert Path(db_file_path()).exists()


def test_list_backups_finds_created_file(isolated_db, tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(isolated_db))
    get_conn()
    reset_connection()
    create_backup()
    names = [p.name for p in list_backups()]
    assert any(n.startswith("guardian_") for n in names)
