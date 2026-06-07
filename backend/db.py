"""
db.py — SQLite + sqlite-vec database layer.

IMPORTANT: get_conn() is the only public entry point. It is LAZY — never called
at module import time. Call it from inside process_event() only, so that a
failing extension load or missing file never blocks the HAS_TANMAY import gate.

Schema is managed by Alembic migrations (see migrations/ and migrate.py).
On first connect, pending migrations are applied automatically.

sqlite-vec landmine: Python's stdlib sqlite3 is often compiled without
loadable-extension support. enable_load_extension() may raise AttributeError
(not OperationalError) before sqlite_vec.load() is reached. Both calls live in
the same try/except.
"""

import logging
import os
import sqlite3
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

_conn: Optional[sqlite3.Connection] = None
VEC_AVAILABLE: bool = False
_migrations_applied: bool = False

_VEC_TABLE = """
CREATE VIRTUAL TABLE IF NOT EXISTS vec_baselines USING vec0(
    baseline_id INTEGER PRIMARY KEY,
    embedding   FLOAT[768]
);
"""

# ---------------------------------------------------------------------------
# Connection + init
# ---------------------------------------------------------------------------


def db_file_path() -> str:
    raw = os.getenv("DB_PATH", "./guardian.db")
    if os.path.isabs(raw):
        return raw
    return str((Path(__file__).resolve().parent / raw).resolve())


def run_migrations() -> None:
    """Apply Alembic migrations up to head (idempotent)."""
    global _migrations_applied
    if _migrations_applied:
        return
    from migrate import upgrade_head  # noqa: PLC0415

    upgrade_head()
    _migrations_applied = True
    log.info("Database migrations at head ✓")


def get_conn() -> sqlite3.Connection:
    """Return (or lazily create) the singleton SQLite connection."""
    global _conn, VEC_AVAILABLE
    if _conn is not None:
        return _conn

    path = db_file_path()
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    run_migrations()

    _conn = sqlite3.connect(path, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL")
    _conn.execute("PRAGMA wal_autocheckpoint=1000")
    _conn.execute("PRAGMA busy_timeout=5000")
    _conn.execute("PRAGMA foreign_keys=ON")

    VEC_AVAILABLE = _load_vec(_conn)
    return _conn


def _load_vec(conn: sqlite3.Connection) -> bool:
    """Load sqlite-vec extension. Returns True on success, False on any failure."""
    try:
        conn.enable_load_extension(True)   # raises AttributeError on stripped builds
        import sqlite_vec                   # noqa: PLC0415
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)
        conn.executescript(_VEC_TABLE)
        conn.commit()
        _ensure_vec_orphan_trigger(conn)
        log.info("sqlite-vec loaded ✓  vec_baselines table ready")
        return True
    except (AttributeError, sqlite3.OperationalError, ImportError, Exception) as exc:
        log.warning("sqlite-vec unavailable (%s) — cosine will use numpy fallback", exc)
        try:
            conn.enable_load_extension(False)
        except Exception:
            pass
        return False


def _ensure_vec_orphan_trigger(conn: sqlite3.Connection) -> None:
    """Delete vec_baselines rows when parent baseline row is removed."""
    conn.execute("DROP TRIGGER IF EXISTS trg_baselines_delete_vec")
    conn.execute(
        """
        CREATE TRIGGER trg_baselines_delete_vec
        AFTER DELETE ON baselines
        FOR EACH ROW
        BEGIN
            DELETE FROM vec_baselines WHERE baseline_id = OLD.id;
        END
        """
    )
    conn.commit()


def reset_connection() -> None:
    """Close and clear the cached connection (used between test scenarios)."""
    global _conn, VEC_AVAILABLE, _migrations_applied
    if _conn is not None:
        try:
            _conn.close()
        except Exception:
            pass
        _conn = None
        VEC_AVAILABLE = False
    _migrations_applied = False


def current_schema_revision() -> str | None:
    """Return the applied Alembic revision id, or None before first migration."""
    from migrate import current_revision  # noqa: PLC0415

    return current_revision()
