"""
backup.py — SQLite backup, WAL checkpoint, and restore for Guardian.

Uses the SQLite online backup API (safe under WAL mode).

Usage (from backend/):
    python backup.py create              # → backups/guardian_YYYYMMDD_HHMMSS.db
    python backup.py create --dest /tmp/snap.db
    python backup.py list
    python backup.py restore --from backups/guardian_....db
    python backup.py vacuum              # checkpoint WAL + VACUUM source DB
"""

from __future__ import annotations

import argparse
import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def db_path() -> Path:
    raw = os.getenv("DB_PATH", "./guardian.db")
    path = Path(raw)
    if not path.is_absolute():
        path = (Path(__file__).resolve().parent / path).resolve()
    return path


def backup_dir() -> Path:
    d = db_path().parent / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def checkpoint_wal(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")


def create_backup(dest: Path | None = None) -> Path:
    """Snapshot the database using sqlite3.Connection.backup()."""
    src_path = db_path()
    if not src_path.exists():
        raise FileNotFoundError(f"Database not found: {src_path}")

    if dest is None:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        dest = backup_dir() / f"guardian_{stamp}.db"

    dest.parent.mkdir(parents=True, exist_ok=True)

    src = sqlite3.connect(src_path)
    try:
        checkpoint_wal(src)
        dst = sqlite3.connect(dest)
        try:
            src.backup(dst)
            dst.commit()
        finally:
            dst.close()
    finally:
        src.close()

    # Copy WAL sidecar metadata if present (backup API consolidates into main file).
    return dest.resolve()


def list_backups() -> list[Path]:
    return sorted(backup_dir().glob("guardian_*.db"), reverse=True)


def restore_backup(backup_file: Path, *, confirm: bool = False) -> Path:
    """Replace the live database with a backup snapshot."""
    backup_file = backup_file.resolve()
    if not backup_file.exists():
        raise FileNotFoundError(backup_file)

    target = db_path()
    if not confirm:
        raise RuntimeError(
            "Restore is destructive. Pass --yes to confirm overwriting "
            f"{target}"
        )

    # Close any open handles in this process.
    try:
        from db import reset_connection  # noqa: PLC0415

        reset_connection()
    except Exception:
        pass

    pre_restore = target.parent / f"{target.name}.pre_restore"
    if target.exists():
        shutil.copy2(target, pre_restore)

    shutil.copy2(backup_file, target)
    for suffix in ("-wal", "-shm"):
        sidecar = Path(str(target) + suffix)
        if sidecar.exists():
            sidecar.unlink()

    return target


def vacuum_database() -> None:
    """Checkpoint WAL and compact the live database file."""
    path = db_path()
    conn = sqlite3.connect(path)
    try:
        checkpoint_wal(conn)
        conn.execute("VACUUM")
        conn.commit()
    finally:
        conn.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Guardian database backup tools")
    sub = parser.add_subparsers(dest="cmd", required=True)

    create_p = sub.add_parser("create", help="Create a backup snapshot")
    create_p.add_argument("--dest", type=Path, default=None)

    sub.add_parser("list", help="List available backups")

    restore_p = sub.add_parser("restore", help="Restore from a backup file")
    restore_p.add_argument("--from", dest="src", type=Path, required=True)
    restore_p.add_argument("--yes", action="store_true", help="Confirm overwrite")

    sub.add_parser("vacuum", help="Checkpoint WAL and VACUUM the live DB")

    args = parser.parse_args(argv)

    if args.cmd == "create":
        path = create_backup(args.dest)
        print(path)
        return 0
    if args.cmd == "list":
        backups = list_backups()
        if not backups:
            print("(no backups)")
            return 0
        for p in backups:
            size_kb = p.stat().st_size // 1024
            print(f"{p.name}\t{size_kb} KB\t{p}")
        return 0
    if args.cmd == "restore":
        restore_backup(args.src, confirm=args.yes)
        print(f"Restored {args.src} → {db_path()}")
        return 0
    if args.cmd == "vacuum":
        vacuum_database()
        print(f"VACUUM complete: {db_path()}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
