"""
voice_checkin.py — personal-baseline voice deviation index.

Computes a normalized per-field deviation index over simulated speech features.
This is NOT a true nomic-embed-text embedding cosine — no STT runs on-device.

When the simulator injects baseline_deviation_cosine, we pass it through verbatim
(demo-safety passthrough guard).
"""

from __future__ import annotations

import copy
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from config import (
    BASELINE_WINDOW_DAYS,
    COLD_START_DAYS,
    VOICE_BASELINE_MIN_SAMPLES,
    VOICE_CONFUSION_FLOOR,
    VOICE_LATENCY_ABSOLUTE_RED_S,
    VOICE_WEIGHT_CLARITY,
    VOICE_WEIGHT_CONFUSION,
    VOICE_WEIGHT_LATENCY,
    VOICE_WEIGHT_SPEECH_RATE,
)

log = logging.getLogger(__name__)

VOICE_EVENT_TYPES = frozenset({"voice_checkin_completed", "voice_distress_detected"})


def _parse_ts(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _has_injected_cosine(payload: dict) -> bool:
    val = payload.get("baseline_deviation_cosine")
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _drop_deviation(current: float, baseline: float) -> float:
    if baseline <= 0:
        return 0.0
    return _clamp01((baseline - current) / baseline)


def _rise_deviation(current: float, baseline: float) -> float:
    if baseline <= 0:
        return 0.0
    return _clamp01((current - baseline) / baseline)


def _latency_deviation(current: float, baseline: float) -> float:
    rel = _rise_deviation(current, baseline)
    if current >= VOICE_LATENCY_ABSOLUTE_RED_S:
        abs_dev = _clamp01((current - VOICE_LATENCY_ABSOLUTE_RED_S) / VOICE_LATENCY_ABSOLUTE_RED_S)
        return max(rel, abs_dev)
    return rel


def _confusion_deviation(confused: bool) -> float:
    return VOICE_CONFUSION_FLOOR if confused else 0.0


def _load_baseline_stats(conn, event_ts: str) -> Optional[dict[str, float]]:
    """Rolling BASELINE_WINDOW_DAYS personal baseline from voice_checkins."""
    try:
        end = _parse_ts(event_ts)
    except Exception:
        end = datetime.now(timezone.utc)
    start = end - timedelta(days=BASELINE_WINDOW_DAYS)

    rows = conn.execute(
        """SELECT speech_rate_wpm, clarity_score, response_latency_s, confusion_markers,
                  substr(timestamp, 1, 10) AS day
           FROM voice_checkins
           WHERE timestamp >= ? AND timestamp < ?
           ORDER BY timestamp""",
        (start.isoformat(), end.isoformat()),
    ).fetchall()

    if len(rows) < VOICE_BASELINE_MIN_SAMPLES:
        return None

    distinct_days = len({r[4] for r in rows})
    if distinct_days < COLD_START_DAYS:
        return None

    rates = [float(r[0]) for r in rows if r[0] is not None]
    clarities = [float(r[1]) for r in rows if r[1] is not None]
    latencies = [float(r[2]) for r in rows if r[2] is not None]
    if not rates or not clarities or not latencies:
        return None

    return {
        "speech_rate_wpm": sum(rates) / len(rates),
        "clarity_score": sum(clarities) / len(clarities),
        "response_latency_s": sum(latencies) / len(latencies),
    }


def compute_voice_deviation(
    payload: dict,
    *,
    conn=None,
    event_ts: Optional[str] = None,
) -> Optional[float]:
    """
    Return baseline_deviation_cosine for a voice payload.
    Passthrough if already injected; None on cold-start.
    """
    if _has_injected_cosine(payload):
        return round(float(payload["baseline_deviation_cosine"]), 2)

    if conn is None or not event_ts:
        return None

    baseline = _load_baseline_stats(conn, event_ts)
    if baseline is None:
        return None

    clarity = float(payload.get("clarity_score") or 0)
    latency = float(payload.get("response_latency_s") or 0)
    rate = float(payload.get("speech_rate_wpm") or 0)
    confused = bool(payload.get("confusion_markers", False))

    clarity_dev = _drop_deviation(clarity, baseline["clarity_score"])
    latency_dev = _latency_deviation(latency, baseline["response_latency_s"])
    rate_dev = _drop_deviation(rate, baseline["speech_rate_wpm"])
    confusion_dev = _confusion_deviation(confused)

    score = (
        VOICE_WEIGHT_CLARITY * clarity_dev
        + VOICE_WEIGHT_LATENCY * latency_dev
        + VOICE_WEIGHT_SPEECH_RATE * rate_dev
        + VOICE_WEIGHT_CONFUSION * confusion_dev
    )
    return round(_clamp01(score), 2)


def _persist_voice_checkin(event: dict, payload: dict) -> None:
    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        conn.execute(
            """INSERT OR IGNORE INTO voice_checkins
               (timestamp, speech_rate_wpm, clarity_score, sentiment,
                confusion_markers, response_latency_s, duration_s,
                baseline_deviation_cosine)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                event.get("timestamp"),
                payload.get("speech_rate_wpm"),
                payload.get("clarity_score"),
                payload.get("sentiment"),
                1 if payload.get("confusion_markers") else 0,
                payload.get("response_latency_s"),
                payload.get("duration_s"),
                payload.get("baseline_deviation_cosine"),
            ),
        )
        conn.commit()
    except Exception as exc:
        log.debug("voice_checkin persist failed (%s)", exc)


def enrich_event(event: dict) -> dict:
    """Attach computed baseline_deviation_cosine; persist voice_checkins row."""
    rec = copy.deepcopy(event)
    et = rec.get("event_type") or ""
    if et not in VOICE_EVENT_TYPES:
        return rec

    payload: dict[str, Any] = dict(rec.get("payload") or {})
    ts = rec.get("timestamp") or ""

    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
        if not _has_injected_cosine(payload):
            dev = compute_voice_deviation(payload, conn=conn, event_ts=ts)
            if dev is not None:
                payload["baseline_deviation_cosine"] = dev
        rec["payload"] = payload
        _persist_voice_checkin(rec, payload)
    except Exception as exc:
        log.warning("enrich_event failed (%s)", exc)

    return rec


def reset_voice_state() -> None:
    """Hook for scenario resets — stateless module, no-op."""
