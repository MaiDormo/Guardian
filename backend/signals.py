"""
signals.py — 8-signal green/amber/red/unknown state machine.

Public API (main.py imports update_signal_state to gate HAS_TANMAY):
  update_signal_state(event, *, now=None) -> list[dict]   signal_update envelopes
  reset() -> None                                         clear between scenarios
  current_states() -> dict                                snapshot for replay.py

Thresholds replicate _process_event_inplace (main.py:125-233) exactly.
Constants imported from config.py — ONE place each.
"""

import threading
from datetime import datetime, timezone
from typing import Optional

from config import (
    ATE_DWELL_GREEN_S,
    COLD_START_DAYS,
    LOCATION_DENSITY_AMBER,
    ROUTINE_COSINE_AMBER,
    ROUTINE_COSINE_RED,
    VOICE_CLARITY_AMBER,
    WOKE_WINDOW_END_H,
    WOKE_WINDOW_START_H,
)

SIGNALS = [
    "woke_up", "ate", "took_meds", "rested_well",
    "helper_present", "voice_checkin", "location", "routine",
]

_lock = threading.Lock()
_states: dict[str, dict] = {
    s: {"state": "unknown", "reason": "", "cosine_distance": None, "updated_at": None}
    for s in SIGNALS
}
# ISO8601 of the first event processed — used for cold-start gate
_first_event_ts: Optional[str] = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def update_signal_state(
    event: dict,
    *,
    now: Optional[datetime] = None,
) -> list[dict]:
    """
    Derive signal_update SSE envelopes from *event*.
    Returns [] for event types that produce no signal change (e.g. presence_ended,
    fall_detected — the latter is handled as a fast-path in ingestion.py).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    _record_first_event(event.get("timestamp"))

    et: str = event.get("event_type") or ""
    room: str = event.get("room") or ""
    payload: dict = event.get("payload") or {}
    ts_str: str = event.get("timestamp") or _ts()

    results: list[dict] = []

    if et == "presence_detected":
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            hour = ts.hour
        except Exception:
            hour = now.hour

        if room == "bedroom" and WOKE_WINDOW_START_H <= hour <= WOKE_WINDOW_END_H:
            results.append(_set("woke_up", "green", f"Bedroom motion at {hour:02d}:xx"))

        elif room == "kitchen":
            dwell: int = int(payload.get("dwell_s") or 0)
            if dwell >= ATE_DWELL_GREEN_S:
                results.append(_set("ate", "green", f"Kitchen dwell {dwell // 60} min"))
            elif dwell > 0:
                results.append(_set("ate", "amber", f"Kitchen dwell only {dwell // 60} min"))

    elif et == "dispenser_opened":
        compartment = payload.get("compartment", "morning")
        results.append(_set("took_meds", "green", f"Dispenser opened — compartment {compartment}"))

    elif et == "dispenser_missed":
        minutes = payload.get("minutes_overdue", 0)
        results.append(_set("took_meds", "red", f"Dispenser missed — {minutes} min overdue"))

    elif et == "breathing_update":
        in_baseline: bool = bool(payload.get("in_baseline", True))
        rate = payload.get("rate_bpm", "?")
        state = "green" if in_baseline else "amber"
        results.append(_set("rested_well", state, f"Breathing rate {rate} bpm"))

    elif et == "multi_presence_detected":
        results.append(_set("helper_present", "green", "Second presence detected in helper window"))

    elif et == "voice_checkin_completed":
        confused: bool = bool(payload.get("confusion_markers", False))
        clarity = float(payload.get("clarity_score") or 1.0)
        if confused:
            state = "red"
        elif clarity < VOICE_CLARITY_AMBER:
            state = "amber"
        else:
            state = "green"
        reason = (
            f"Speech {payload.get('speech_rate_wpm')} wpm, "
            f"clarity {payload.get('clarity_score')}"
            + (", confusion markers" if confused else "")
        )
        results.append(_set("voice_checkin", state, reason))

    elif et == "voice_distress_detected":
        reason = (
            f"Distress: {payload.get('speech_rate_wpm')} wpm, "
            f"clarity {payload.get('clarity_score')}, confusion markers, "
            f"latency {payload.get('response_latency_s')}s"
        )
        cosine = payload.get("baseline_deviation_cosine")
        results.append(_set("voice_checkin", "red", reason, cosine=cosine))

    elif et == "location_update":
        match: bool = bool(payload.get("baseline_cluster_match", True))
        score: float = float(payload.get("trajectory_density_score") or 1.0)
        state = "green" if match else ("amber" if score > LOCATION_DENSITY_AMBER else "red")
        results.append(_set("location", state, f"Density score {score:.2f}"))

    elif et == "wandering_detected":
        minutes = payload.get("minutes_outside_baseline_footprint", 0)
        score = float(payload.get("trajectory_density_score") or 0)
        reason = f"Outside baseline footprint {minutes} min, density {score:.2f}"
        results.append(_set("location", "red", reason))

    elif et == "cosine_update":
        score = float(payload.get("cosine_distance") or 0.0)
        # When the simulator/baseline module supplies cosine_distance it is
        # pre-computed against the 30-day baseline — trust it unconditionally.
        # Cold-start only blocks cosines WE compute (currently unused on demo path).
        # PRD §5.2: no cosine comparison before COLD_START_DAYS when computing live.
        if payload.get("cosine_distance") is None and _in_cold_start(ts_str):
            results.append(_set(
                "routine", "unknown", "Insufficient baseline history (cold start)",
                cosine=None,
            ))
        else:
            state = (
                "green" if score < ROUTINE_COSINE_AMBER
                else ("amber" if score < ROUTINE_COSINE_RED else "red")
            )
            results.append(_set("routine", state, f"Cosine distance {score:.2f}", cosine=score))

    return [r for r in results if r is not None]


def reset() -> None:
    """Clear all in-memory state between demo scenarios."""
    global _states, _first_event_ts
    with _lock:
        _states = {
            s: {"state": "unknown", "reason": "", "cosine_distance": None, "updated_at": None}
            for s in SIGNALS
        }
        _first_event_ts = None


def current_states() -> dict[str, dict]:
    """Snapshot of all 8 signal states (used by replay.py accuracy gate)."""
    with _lock:
        return {k: dict(v) for k, v in _states.items()}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _set(
    signal: str,
    state: str,
    reason: str,
    cosine: Optional[float] = None,
) -> dict:
    updated_at = _ts()
    with _lock:
        _states[signal] = {
            "state": state,
            "reason": reason,
            "cosine_distance": cosine,
            "updated_at": updated_at,
        }
    return {
        "event": "signal_update",
        "payload": {
            "signal": signal,
            "state": state,
            "reason": reason,
            "cosine_distance": cosine,
            "updated_at": updated_at,
        },
    }


def _record_first_event(ts_str: Optional[str]) -> None:
    global _first_event_ts
    if _first_event_ts is None and ts_str:
        with _lock:
            if _first_event_ts is None:
                _first_event_ts = ts_str


def _in_cold_start(ts_str: str) -> bool:
    """True if we're within COLD_START_DAYS of the first recorded event."""
    if _first_event_ts is None:
        return True
    try:
        first = datetime.fromisoformat(_first_event_ts.replace("Z", "+00:00"))
        current = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        delta_days = (current - first).total_seconds() / 86400
        return delta_days < COLD_START_DAYS
    except Exception:
        return False
