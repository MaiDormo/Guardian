"""
migrate.py — Run Alembic migrations programmatically.

Usage (from backend/):
    python migrate.py upgrade
    python migrate.py current
    python migrate.py downgrade -1
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config


def _alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parent
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "migrations"))

    db_path = os.getenv("DB_PATH", "./guardian.db")
    if not os.path.isabs(db_path):
        db_path = str((backend_dir / db_path).resolve())
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path}")
    return cfg


def upgrade_head() -> None:
    command.upgrade(_alembic_config(), "head")


def current_revision() -> str | None:
    cfg = _alembic_config()
    from alembic.runtime.migration import MigrationContext
    from sqlalchemy import create_engine

    engine = create_engine(cfg.get_main_option("sqlalchemy.url"))
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        return ctx.get_current_revision()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Guardian DB migrations")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("upgrade", help="Apply all pending migrations")
    sub.add_parser("current", help="Show current revision")
    down = sub.add_parser("downgrade", help="Roll back migrations")
    down.add_argument("target", nargs="?", default="-1")

    args = parser.parse_args(argv)
    cfg = _alembic_config()

    if args.cmd == "upgrade":
        command.upgrade(cfg, "head")
        print("Migrations applied: head")
        return 0
    if args.cmd == "current":
        rev = current_revision()
        print(rev or "(no migrations applied)")
        return 0
    if args.cmd == "downgrade":
        command.downgrade(cfg, args.target)
        print(f"Downgraded to {args.target}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
