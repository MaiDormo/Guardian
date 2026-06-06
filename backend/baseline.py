"""
baseline.py — nomic-embed-text embeddings and cosine baseline management.

Demo path: compute_cosine() passes through the simulator-supplied
cosine_distance — never blocks on Ollama. Live embedding is a stretch.

query_recent_events() backs agent.get_recent_events() with real DB data.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from config import EMBED_DIM, EMBED_MODEL

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cosine — pass-through for demo, live embed as stretch
# ---------------------------------------------------------------------------


def compute_cosine(event: dict) -> Optional[float]:
    """
    Return the cosine distance for a cosine_update event.

    Demo path: pass through payload.cosine_distance (pre-baked by simulator).
    This never blocks on Ollama, satisfying the <5s assessment budget.
    """
    payload = event.get("payload") or {}
    return payload.get("cosine_distance")


def embed_day(summary: str) -> list[float]:
    """
    Embed a day summary via nomic-embed-text (stretch — requires Ollama running).
    Falls back to zero vector on any failure so it never crashes process_event.
    """
    try:
        import ollama  # noqa: PLC0415
        result = ollama.embeddings(model=EMBED_MODEL, prompt=summary)
        return result["embedding"]
    except Exception as exc:
        log.warning("embed_day failed (%s) — zero vector fallback", exc)
        return [0.0] * EMBED_DIM


def store_baseline(day: str, summary: str, signal: Optional[str] = None) -> None:
    """Persist a day summary row to the baselines table."""
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        conn.execute(
            """INSERT OR IGNORE INTO baselines (day, signal, summary, created_at)
               VALUES (?, ?, ?, ?)""",
            (day, signal, summary, _ts()),
        )
        conn.commit()
    except Exception as exc:
        log.warning("store_baseline failed (%s)", exc)


# ---------------------------------------------------------------------------
# Recent events — backs agent.get_recent_events
# ---------------------------------------------------------------------------


def query_recent_events(
    hours: float = 24.0,
    event_type: Optional[str] = None,
) -> list[dict]:
    """
    Return recent events from DB for the agent's reasoning context.
    Returns [] on any failure — agent falls back to its stub gracefully.
    """
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        interval = f"-{int(hours)} hours"
        if event_type:
            rows = conn.execute(
                """SELECT * FROM events
                   WHERE event_type = ?
                     AND ingested_at > datetime('now', ?)
                   ORDER BY timestamp DESC LIMIT 50""",
                (event_type, interval),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT * FROM events
                   WHERE ingested_at > datetime('now', ?)
                   ORDER BY timestamp DESC LIMIT 50""",
                (interval,),
            ).fetchall()
        return [_row_to_dict(r) for r in rows]
    except Exception as exc:
        log.warning("query_recent_events failed (%s)", exc)
        return []


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_dict(row) -> dict:
    d = dict(row)
    if "payload" in d and isinstance(d["payload"], str):
        try:
            d["payload"] = json.loads(d["payload"])
        except Exception:
            pass
    return d
