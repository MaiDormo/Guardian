"""
ingestion.py — Guardian data-layer orchestrator. The single entry point
that main.py imports and calls via asyncio.to_thread.

Public API:
  process_event(event: dict) -> list[dict]   SYNC — returns SSE envelopes
  reset_state() -> None                      called by _reset_state() in main.py

CRITICAL: process_event must be a plain `def` (not async). main.py calls it
via asyncio.to_thread(). An async def would return a coroutine that the calling
loop cannot iterate, causing silent fallback to _process_event_inplace.

DB + sqlite-vec are opened lazily on first call — never at import time.
A module-import-time failure would flip HAS_TANMAY=False for ALL modules,
disabling the entire data layer silently.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

log = logging.getLogger(__name__)

_db_ready: bool = False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def process_event(event: dict) -> list[dict]:
    """
    Normalise, persist, and derive SSE envelopes for one incoming sensor event.

    Returns a list of fully-formed SSE dicts {event: str, payload: dict}.
    Never raises on valid input — exceptions are caught and logged.

    Processing order:
      1. Fall fast-path (bypass all other logic)
      2. Normalise via edge_processor
      3. Persist to DB (INSERT OR IGNORE — dedup)
      4. Emit presence_update SSE for presence events
      5. Emit raw location SSE for GPS events
      6. Run signal state machine for signal_update(s)
    """
    _lazy_init_db()

    et: str = event.get("event_type") or ""
    room: str = event.get("room") or ""
    payload: dict = event.get("payload") or {}
    timestamp: str = event.get("timestamp") or _ts()

    # ── 1. Fall fast-path ────────────────────────────────────────────────────
    # PRD §5.2: fall is priority_red — bypasses agent loop and state machine.
    # Returns fall_detected + presence_update(fall=True). NO signal_update.
    if et == "fall_detected":
        fall_room = room or "bathroom"
        _write_raw(event)
        return [
            {
                "event": "fall_detected",
                "payload": {
                    "room": fall_room,
                    "posture": payload.get("posture", "prone"),
                    "stationary_s": payload.get("stationary_s", 0),
                    "confidence": float(event.get("confidence") or 0.95),
                    "updated_at": timestamp,
                },
            },
            {
                "event": "presence_update",
                "payload": {
                    "room": fall_room,
                    "occupied": True,
                    "fall": True,
                    "updated_at": timestamp,
                },
            },
        ]

    # ── 2. Normalise ─────────────────────────────────────────────────────────
    try:
        from edge_processor import normalize  # noqa: PLC0415
        rec = normalize(event)
    except Exception as exc:
        log.warning("normalize failed (%s) — using raw event", exc)
        rec = _raw_normalize(event)

    # ── 2b. Voice enrichment (deviation index; passthrough if pre-injected) ──
    if et in ("voice_checkin_completed", "voice_distress_detected"):
        try:
            from voice_checkin import enrich_event  # noqa: PLC0415
            rec = enrich_event(rec)
        except Exception as exc:
            log.warning("voice_checkin.enrich_event failed (%s)", exc)

    # ── 3. Persist (dedup) ───────────────────────────────────────────────────
    if not _write_event(rec):
        return []  # duplicate — skip all downstream processing

    # ── 4. Presence SSE ──────────────────────────────────────────────────────
    sse_out: list[dict] = []

    if et == "presence_detected":
        sse_out.append({
            "event": "presence_update",
            "payload": {
                "room": room,
                "occupied": True,
                "fall": False,
                "updated_at": timestamp,
            },
        })
    elif et == "presence_ended":
        sse_out.append({
            "event": "presence_update",
            "payload": {
                "room": room,
                "occupied": False,
                "fall": False,
                "updated_at": timestamp,
            },
        })

    # ── 5. Raw location SSE ──────────────────────────────────────────────────
    if et in ("location_update", "wandering_detected"):
        try:
            from location import process_location  # noqa: PLC0415
            sse_out.extend(process_location(rec))
        except Exception as exc:
            log.warning("location.process_location failed (%s)", exc)

    # ── 6. Signal state machine ──────────────────────────────────────────────
    # Skip presence_ended — it produces no signal change (only the SSE above).
    if et != "presence_ended":
        try:
            from signals import update_signal_state  # noqa: PLC0415
            sse_out.extend(update_signal_state(rec))
        except Exception as exc:
            log.warning("signals.update_signal_state failed (%s)", exc)

    return sse_out


def reset_state() -> None:
    """
    Reset all in-memory accumulators.
    Elia should call this from main._reset_state() between demo scenarios
    so dwell counters / cosine window / location state don't bleed across runs.
    """
    global _db_ready
    try:
        from signals import reset as _sig_reset  # noqa: PLC0415
        _sig_reset()
    except Exception as exc:
        log.warning("signals.reset failed (%s)", exc)

    try:
        from edge_processor import reset_seq  # noqa: PLC0415
        reset_seq()
    except Exception as exc:
        log.warning("edge_processor.reset_seq failed (%s)", exc)

    try:
        from voice_checkin import reset_voice_state  # noqa: PLC0415
        reset_voice_state()
    except Exception as exc:
        log.warning("voice_checkin.reset_voice_state failed (%s)", exc)

    # Scenario replays use fixed timestamps — clear replay log so dedup never
    # drops Day-7 voice/wandering events on the second demo run.
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        conn.execute("DELETE FROM events")
        conn.commit()
    except Exception as exc:
        log.warning("events table clear failed (%s)", exc)

    # Re-init DB on next event (picks up a fresh guardian.db if scenario resets it)
    _db_ready = False


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------


def _lazy_init_db() -> None:
    global _db_ready
    if not _db_ready:
        try:
            from db import get_conn  # noqa: PLC0415
            get_conn()
            _db_ready = True
        except Exception as exc:
            log.warning("DB init failed (%s) — running stateless", exc)


def _write_event(rec: dict) -> bool:
    """
    INSERT OR IGNORE into events table.
    Returns True if the row was inserted (new event), False if duplicate.
    On write failure returns True to avoid silently dropping events.
    """
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        cursor = conn.execute(
            """INSERT OR IGNORE INTO events
               (event_type, source, room, timestamp, confidence,
                payload, dedup_key, seq, ingested_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                rec.get("event_type", ""),
                rec.get("source", ""),
                rec.get("room"),
                rec.get("timestamp", _ts()),
                float(rec.get("confidence") or 1.0),
                json.dumps(rec.get("payload") or {}),
                rec.get("dedup_key", _fallback_dedup(rec)),
                rec.get("seq", 0),
                _ts(),
            ),
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as exc:
        log.warning("_write_event failed (%s) — treating as new", exc)
        return True


def _write_raw(event: dict) -> None:
    """Best-effort persist without dedup (for fall fast-path)."""
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        dedup = _fallback_dedup(event)
        conn.execute(
            """INSERT OR IGNORE INTO events
               (event_type, source, room, timestamp, confidence,
                payload, dedup_key, seq, ingested_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)""",
            (
                event.get("event_type", ""),
                event.get("source", ""),
                event.get("room"),
                event.get("timestamp", _ts()),
                float(event.get("confidence") or 1.0),
                json.dumps(event.get("payload") or {}),
                dedup,
                _ts(),
            ),
        )
        conn.commit()
    except Exception as exc:
        log.debug("_write_raw failed (%s)", exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _raw_normalize(event: dict) -> dict:
    """Minimal normalise when edge_processor is unavailable."""
    return {
        "event_type": event.get("event_type") or "",
        "source": event.get("source") or "",
        "room": event.get("room"),
        "timestamp": event.get("timestamp") or _ts(),
        "confidence": float(event.get("confidence") or 1.0),
        "payload": event.get("payload") or {},
        "dedup_key": _fallback_dedup(event),
        "seq": 0,
    }


def _fallback_dedup(event: dict) -> str:
    raw = (
        f"{event.get('event_type')}|{event.get('source')}"
        f"|{event.get('room')}|{event.get('timestamp')}"
        f"|{json.dumps(event.get('payload') or {}, sort_keys=True)}"
    )
    return hashlib.sha1(raw.encode()).hexdigest()
