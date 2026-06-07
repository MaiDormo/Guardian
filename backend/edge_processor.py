"""
edge_processor.py — Normalise incoming events before persistence.

normalize(event) → canonical dict with dedup_key and seq added.

Dedup strategy: sha1(type|source|room|timestamp|payload_json|seq) where seq is
a per-process monotonic counter. This ensures same-second identical replays
(e.g. two cosine_update 0.04 events in trend_7day) never collide on the dedup
key, while literal double-POSTs of the exact same in-memory event do collide
(same seq, same timestamp). Only true duplicates are dropped.

Set DEDUP_TEST_MODE=true to append a UUID (for persistent test DBs across runs).
"""

import hashlib
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

_seq_lock = threading.Lock()
_seq_counter: int = 0

_DEDUP_TEST_MODE = os.getenv("DEDUP_TEST_MODE", "false").lower() in ("1", "true", "yes")


def normalize(event: dict) -> dict:
    """Return a canonical copy of *event* with dedup_key and seq fields added."""
    global _seq_counter
    with _seq_lock:
        _seq_counter += 1
        seq = _seq_counter

    event_type: str = event.get("event_type") or ""
    source: str = event.get("source") or ""
    room: Optional[str] = event.get("room")        # None for non-room events
    timestamp: str = event.get("timestamp") or _ts()
    confidence: float = float(event.get("confidence") or 1.0)
    payload: dict = event.get("payload") or {}

    dedup_key = _make_dedup_key(event_type, source, room, timestamp, payload, seq)

    return {
        "event_type": event_type,
        "source": source,
        "room": room,
        "timestamp": timestamp,
        "confidence": confidence,
        "payload": payload,
        "dedup_key": dedup_key,
        "seq": seq,
    }


def _make_dedup_key(
    event_type: str,
    source: str,
    room: Optional[str],
    timestamp: str,
    payload: dict,
    seq: int,
) -> str:
    raw = (
        f"{event_type}|{source}|{room}|{timestamp}"
        f"|{json.dumps(payload, sort_keys=True)}|{seq}"
    )
    if _DEDUP_TEST_MODE:
        raw += f"|{uuid.uuid4().hex}"
    return hashlib.sha1(raw.encode()).hexdigest()


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def reset_seq() -> None:
    """Reset the monotonic counter (useful in tests)."""
    global _seq_counter
    with _seq_lock:
        _seq_counter = 0
