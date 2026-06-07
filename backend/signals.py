"""
signals.py — 8-signal green/amber/red/unknown state machine.

Public API (main.py imports update_signal_state to gate HAS_TANMAY):
  update_signal_state(event, *, now=None) -> list[dict]   signal_update envelopes
  reset() -> None                                         clear between scenarios
  current_states() -> dict                                snapshot for replay.py

Thresholds replicate _process_event_inplace (main.py:125-233) exactly, plus
PRD §5.2 amber-timeout escalation and §5.1 time-window rules (took_meds, woke_up).
Constants imported from config.py — ONE place each.
"""

import threading
from datetime import datetime, timezone
from typing import Optional

from config import (
    ACTIVE_SOURCES,
    AMBER_TIMEOUT_ACTIVE_H,
    AMBER_TIMEOUT_PASSIVE_H,
    ATE_DWELL_GREEN_S,
    COLD_START_DAYS,
    LOCATION_DENSITY_AMBER,
    ROUTINE_COSINE_AMBER,
    ROUTINE_COSINE_RED,
    TOOK_MEDS_DEADLINE_H,
    TOOK_MEDS_RED_OVERDUE_MIN,
    VOICE_CLARITY_AMBER,
    WOKE_UP_AMBER_DEADLINE_H,
    WOKE_WINDOW_END_H,
    WOKE_WINDOW_START_H,
)

SIGNALS = [
    "woke_up", "ate", "took_meds", "rested_well",
    "helper_present", "voice_checkin", "location", "routine",
]

# Only absence-based ambers escalate via §5.2 timeouts (not measurement drift).
_ABSENCE_AMBER_SIGNALS: frozenset[str] = frozenset({"woke_up", "took_meds"})

_lock = threading.Lock()
_force_emit_ctx = False
_states: dict[str, dict] = {
    s: {"state": "unknown", "reason": "", "cosine_distance": None, "updated_at": None}
    for s in SIGNALS
}
# ISO8601 of the first event processed — used for cold-start gate
_first_event_ts: Optional[str] = None
# Amber-timeout machine (§5.2)
_amber_since: dict[str, Optional[str]] = {s: None for s in SIGNALS}
_last_sources: dict[str, str] = {s: "baseline" for s in SIGNALS}
# Daily absence tracking for time-window rules
_dispenser_open_dates: set[str] = set()
_bedroom_motion_dates: set[str] = set()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def update_signal_state(
    event: dict,
    *,
    now: Optional[datetime] = None,
    force_emit: bool = False,
) -> list[dict]:
    """
    Derive signal_update SSE envelopes from *event*.
    Returns [] for event types that produce no signal change (e.g. presence_ended,
    fall_detected — the latter is handled as a fast-path in ingestion.py).
    """
    if now is None:
        now = datetime.now(timezone.utc)

    global _force_emit_ctx
    prev_force_emit = _force_emit_ctx
    _force_emit_ctx = force_emit
    try:
        return _update_signal_state_inner(event, now=now)
    finally:
        _force_emit_ctx = prev_force_emit


def _update_signal_state_inner(
    event: dict,
    *,
    now: datetime,
) -> list[dict]:
    _record_first_event(event.get("timestamp"))

    et: str = event.get("event_type") or ""
    room: str = event.get("room") or ""
    payload: dict = event.get("payload") or {}
    ts_str: str = event.get("timestamp") or _ts()
    source: str = event.get("source") or "baseline"

    results: list[Optional[dict]] = []

    if et == "presence_detected":
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            hour = ts.hour
        except Exception:
            hour = now.hour

        if room == "bedroom" and WOKE_WINDOW_START_H <= hour <= WOKE_WINDOW_END_H:
            _bedroom_motion_dates.add(_event_date(ts_str))
            results.append(
                _set(
                    "woke_up",
                    "green",
                    f"Bedroom motion at {ts.strftime('%H:%M')}",
                    source=source,
                    updated_at=ts_str,
                )
            )

        elif room == "kitchen":
            dwell: int = int(payload.get("dwell_s") or 0)
            if dwell >= ATE_DWELL_GREEN_S:
                results.append(
                    _set(
                        "ate",
                        "green",
                        f"Kitchen dwell {dwell // 60} min",
                        source=source,
                        updated_at=ts_str,
                    )
                )
            elif dwell > 0:
                results.append(
                    _set(
                        "ate",
                        "amber",
                        f"Kitchen dwell only {dwell // 60} min",
                        source=source,
                        updated_at=ts_str,
                    )
                )

    elif et == "dispenser_opened":
        compartment = payload.get("compartment", "morning")
        delta = int(payload.get("delta_minutes") or 0)
        _dispenser_open_dates.add(_event_date(ts_str))
        try:
            open_hour = datetime.fromisoformat(ts_str.replace("Z", "+00:00")).hour
        except Exception:
            open_hour = now.hour
        if open_hour >= TOOK_MEDS_DEADLINE_H or delta > TOOK_MEDS_RED_OVERDUE_MIN:
            state = "amber"
            reason = f"Late dose — {delta} min after window"
        else:
            state = "green"
            reason = f"Dispenser opened — compartment {compartment}"
        results.append(
            _set("took_meds", state, reason, source=source, updated_at=ts_str)
        )

    elif et == "dispenser_missed":
        minutes = int(payload.get("minutes_overdue") or 0)
        state = (
            "red"
            if minutes > TOOK_MEDS_RED_OVERDUE_MIN
            else "amber"
        )
        results.append(
            _set(
                "took_meds",
                state,
                f"Dispenser missed — {minutes} min overdue",
                source=source,
                updated_at=ts_str,
            )
        )

    elif et == "breathing_update":
        in_baseline: bool = bool(payload.get("in_baseline", True))
        rate = payload.get("rate_bpm", "?")
        state = "green" if in_baseline else "amber"
        results.append(
            _set(
                "rested_well",
                state,
                f"Breathing rate {rate} bpm",
                source=source,
                updated_at=ts_str,
            )
        )

    elif et == "multi_presence_detected":
        results.append(
            _set(
                "helper_present",
                "green",
                "Second presence detected in helper window",
                source=source,
                updated_at=ts_str,
            )
        )

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
        results.append(
            _set("voice_checkin", state, reason, source=source, updated_at=ts_str)
        )

    elif et == "voice_distress_detected":
        reason = (
            f"Distress: {payload.get('speech_rate_wpm')} wpm, "
            f"clarity {payload.get('clarity_score')}, confusion markers, "
            f"latency {payload.get('response_latency_s')}s"
        )
        cosine = payload.get("baseline_deviation_cosine")
        results.append(
            _set(
                "voice_checkin",
                "red",
                reason,
                cosine=cosine,
                source=source,
                updated_at=ts_str,
            )
        )

    elif et == "location_update":
        match: bool = bool(payload.get("baseline_cluster_match", True))
        score: float = float(payload.get("trajectory_density_score") or 1.0)
        state = "green" if match else ("amber" if score > LOCATION_DENSITY_AMBER else "red")
        results.append(
            _set(
                "location",
                state,
                f"Density score {score:.2f}",
                source=source,
                updated_at=ts_str,
            )
        )

    elif et == "wandering_detected":
        minutes = payload.get("minutes_outside_baseline_footprint", 0)
        score = float(payload.get("trajectory_density_score") or 0)
        reason = f"Outside baseline footprint {minutes} min, density {score:.2f}"
        results.append(
            _set("location", "red", reason, source=source, updated_at=ts_str)
        )

    elif et == "cosine_update":
        score = float(payload.get("cosine_distance") or 0.0)
        if payload.get("cosine_distance") is None and _in_cold_start(ts_str):
            results.append(
                _set(
                    "routine",
                    "unknown",
                    "Insufficient baseline history (cold start)",
                    cosine=None,
                    source=source,
                    updated_at=ts_str,
                )
            )
        else:
            state = (
                "green" if score < ROUTINE_COSINE_AMBER
                else ("amber" if score < ROUTINE_COSINE_RED else "red")
            )
            results.append(
                _set(
                    "routine",
                    state,
                    f"Cosine distance {score:.2f}",
                    cosine=score,
                    source=source,
                    updated_at=ts_str,
                )
            )

    results.extend(_apply_daily_deadlines(ts_str))
    results.extend(_apply_amber_timeouts(ts_str))

    return _merge_results([r for r in results if r is not None])


def reset() -> None:
    """Clear all in-memory state between demo scenarios."""
    global _states, _first_event_ts
    with _lock:
        _states = {
            s: {"state": "unknown", "reason": "", "cosine_distance": None, "updated_at": None}
            for s in SIGNALS
        }
        _first_event_ts = None
        for s in SIGNALS:
            _amber_since[s] = None
            _last_sources[s] = "baseline"
        _dispenser_open_dates.clear()
        _bedroom_motion_dates.clear()


def current_states() -> dict[str, dict]:
    """Snapshot of all 8 signal states (used by replay.py accuracy gate)."""
    with _lock:
        return {k: dict(v) for k, v in _states.items()}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_ts(ts_str: str) -> datetime:
    return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))


def _event_date(ts_str: str) -> str:
    return _parse_ts(ts_str).date().isoformat()


def _set(
    signal: str,
    state: str,
    reason: str,
    cosine: Optional[float] = None,
    *,
    source: str = "baseline",
    updated_at: Optional[str] = None,
) -> Optional[dict]:
    stamp = updated_at or _ts()
    with _lock:
        prev_state = _states[signal]["state"]
        if (
            not _force_emit_ctx
            and prev_state == state
            and _states[signal]["reason"] == reason
        ):
            return None

        if prev_state != "amber" and state == "amber":
            _amber_since[signal] = stamp
        elif state != "amber":
            _amber_since[signal] = None

        if source:
            _last_sources[signal] = source

        _states[signal] = {
            "state": state,
            "reason": reason,
            "cosine_distance": cosine,
            "updated_at": stamp,
        }
    return {
        "event": "signal_update",
        "payload": {
            "signal": signal,
            "state": state,
            "reason": reason,
            "cosine_distance": cosine,
            "updated_at": stamp,
        },
    }


def _apply_daily_deadlines(ts_str: str) -> list[Optional[dict]]:
    """PRD §5.1 time-window rules evaluated on each event timestamp."""
    results: list[Optional[dict]] = []
    try:
        ts = _parse_ts(ts_str)
    except Exception:
        return results

    date = ts.date().isoformat()

    if ts.hour >= WOKE_UP_AMBER_DEADLINE_H and date not in _bedroom_motion_dates:
        with _lock:
            cur = _states["woke_up"]["state"]
        if cur in ("unknown", "green"):
            results.append(
                _set(
                    "woke_up",
                    "amber",
                    "No bedroom motion by 10:00",
                    source="mmwave_ld2410",
                    updated_at=ts_str,
                )
            )

    if ts.hour >= TOOK_MEDS_DEADLINE_H and date not in _dispenser_open_dates:
        with _lock:
            cur = _states["took_meds"]["state"]
        if cur != "red":
            results.append(
                _set(
                    "took_meds",
                    "amber",
                    "No dispenser event by 11:00",
                    source="pill_dispenser",
                    updated_at=ts_str,
                )
            )

    return results


def _apply_amber_timeouts(ts_str: str) -> list[Optional[dict]]:
    """PRD §5.2: escalate stale amber signals to red by source class."""
    results: list[Optional[dict]] = []
    try:
        now = _parse_ts(ts_str)
    except Exception:
        return results

    for signal in _ABSENCE_AMBER_SIGNALS:
        with _lock:
            if _states[signal]["state"] != "amber":
                continue
            since_str = _amber_since.get(signal)
            source = _last_sources.get(signal, "baseline")

        if not since_str:
            continue

        try:
            since = _parse_ts(since_str)
        except Exception:
            continue

        hours = (now - since).total_seconds() / 3600
        timeout = (
            AMBER_TIMEOUT_ACTIVE_H
            if source in ACTIVE_SOURCES
            else AMBER_TIMEOUT_PASSIVE_H
        )
        if hours > timeout:
            results.append(
                _set(
                    signal,
                    "red",
                    f"Amber timeout exceeded ({timeout}h)",
                    source=source,
                    updated_at=ts_str,
                )
            )

    return results


def _merge_results(results: list[dict]) -> list[dict]:
    """Last write per signal wins within a single process_event call."""
    by_signal: dict[str, dict] = {}
    for envelope in results:
        sig = envelope["payload"]["signal"]
        by_signal[sig] = envelope
    return list(by_signal.values())


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
