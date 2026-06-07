"""
replay.py — PRD §7 32-cell accuracy gate (8 signals × 4 scenarios).

Drives ingestion.process_event synchronously. Pass threshold: ≥26/32 correct.
Fall scored separately (not in this matrix).

GAP/ALLOWANCE — three unreachable amber cells (no amber path yet for woke_up/rested_well):
  trend_7day: woke_up, rested_well
  voice_distress: woke_up
These are scored as real misses, never faked.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

import ingestion
import signals

_ROOT = Path(__file__).resolve().parents[2]
_SYNTH = _ROOT / "data" / "synthetic"

SIGNALS = [
    "woke_up", "ate", "took_meds", "rested_well",
    "helper_present", "voice_checkin", "location", "routine",
]

# PRD §7 ground truth — transcribed verbatim
GROUND_TRUTH: dict[tuple[str, str], str] = {
    ("normal", "woke_up"): "green",
    ("normal", "ate"): "green",
    ("normal", "took_meds"): "green",
    ("normal", "rested_well"): "green",
    ("normal", "helper_present"): "green",
    ("normal", "voice_checkin"): "green",
    ("normal", "location"): "green",
    ("normal", "routine"): "green",
    ("trend_7day", "woke_up"): "amber",
    ("trend_7day", "ate"): "amber",
    ("trend_7day", "took_meds"): "amber",
    ("trend_7day", "rested_well"): "amber",
    ("trend_7day", "helper_present"): "green",
    ("trend_7day", "voice_checkin"): "red",
    ("trend_7day", "location"): "red",
    ("trend_7day", "routine"): "red",
    ("wandering", "woke_up"): "green",
    ("wandering", "ate"): "green",
    ("wandering", "took_meds"): "green",
    ("wandering", "rested_well"): "green",
    ("wandering", "helper_present"): "green",
    ("wandering", "voice_checkin"): "green",
    ("wandering", "location"): "red",
    ("wandering", "routine"): "red",
    ("voice_distress", "woke_up"): "amber",
    ("voice_distress", "ate"): "green",
    ("voice_distress", "took_meds"): "green",
    ("voice_distress", "rested_well"): "amber",
    ("voice_distress", "helper_present"): "green",
    ("voice_distress", "voice_checkin"): "red",
    ("voice_distress", "location"): "green",
    ("voice_distress", "routine"): "red",
}

UNREACHABLE_AMBER: set[tuple[str, str]] = {
    ("trend_7day", "woke_up"),
    ("trend_7day", "rested_well"),
    ("voice_distress", "woke_up"),
}


def _stamp_events(events: list[dict], day: str = "2026-06-01") -> list[dict]:
    """Ensure unique timestamps so dedup does not swallow replay events."""
    out = []
    for i, ev in enumerate(events):
        e = copy.deepcopy(ev)
        if not e.get("timestamp"):
            e["timestamp"] = f"{day}T08:{i:02d}:00Z"
        out.append(e)
    return out


def _events_normal() -> list[dict]:
    import main
    raw = copy.deepcopy(main.SCENARIO_EVENTS["normal"])
    return _stamp_events([evt for _, evt in raw], day="2026-06-07")


def _events_trend_7day() -> list[dict]:
    with open(_SYNTH / "trend_7day.json") as f:
        data = json.load(f)
    events: list[dict] = []
    for day in data["days"]:
        events.extend(day["events"])
    return events


def _events_wandering() -> list[dict]:
    """Scenario C — normal morning + wandering + high routine cosine."""
    return [
        {"event_type": "presence_detected", "source": "mmwave_ld2410", "room": "bedroom",
         "timestamp": "2026-06-10T07:30:00Z", "confidence": 0.97,
         "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"}},
        {"event_type": "presence_detected", "source": "mmwave_ld2410", "room": "kitchen",
         "timestamp": "2026-06-10T08:00:00Z", "confidence": 0.97,
         "payload": {"targets": 1, "dwell_s": 1320, "motion": "stationary"}},
        {"event_type": "dispenser_opened", "source": "pill_dispenser",
         "timestamp": "2026-06-10T08:10:00Z", "confidence": 1.0,
         "payload": {"compartment": "morning", "expected_window_start": "08:00", "delta_minutes": 10}},
        {"event_type": "breathing_update", "source": "mmwave_mr60bha2", "room": "bedroom",
         "timestamp": "2026-06-10T06:00:00Z", "confidence": 0.93,
         "payload": {"rate_bpm": 14, "in_baseline": True, "overnight_dwell_h": 7.8}},
        {"event_type": "multi_presence_detected", "source": "mmwave_ld2410", "room": "living_room",
         "timestamp": "2026-06-10T10:00:00Z", "confidence": 0.94,
         "payload": {"targets": 2, "motion": "mixed"}},
        {"event_type": "voice_checkin_completed", "source": "voice_system",
         "timestamp": "2026-06-10T10:05:00Z", "confidence": 0.91,
         "payload": {"speech_rate_wpm": 138, "clarity_score": 0.87, "sentiment": "positive",
                     "confusion_markers": False, "response_latency_s": 1.2, "duration_s": 142}},
        {"event_type": "wandering_detected", "source": "gps_tracker",
         "timestamp": "2026-06-10T11:00:00Z", "confidence": 0.88,
         "payload": {"lat": 22.5512, "lng": 114.0701, "distance_from_home_m": 1800,
                     "trajectory_density_score": 0.09, "baseline_cluster_match": False,
                     "minutes_outside_baseline_footprint": 34}},
        {"event_type": "cosine_update", "source": "baseline",
         "timestamp": "2026-06-10T12:00:00Z", "confidence": 1.0,
         "payload": {"cosine_distance": 0.38}},
    ]


def _events_voice_distress() -> list[dict]:
    """Scenario D — voice distress + routine drift; location stays in footprint."""
    with open(_SYNTH / "voice_distress.json") as f:
        data = json.load(f)
    distress_ev = data["days"][-1]["events"][0]
    return [
        {"event_type": "presence_detected", "source": "mmwave_ld2410", "room": "bedroom",
         "timestamp": "2026-06-11T07:30:00Z", "confidence": 0.97,
         "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"}},
        {"event_type": "presence_detected", "source": "mmwave_ld2410", "room": "kitchen",
         "timestamp": "2026-06-11T08:00:00Z", "confidence": 0.97,
         "payload": {"targets": 1, "dwell_s": 1320, "motion": "stationary"}},
        {"event_type": "dispenser_opened", "source": "pill_dispenser",
         "timestamp": "2026-06-11T08:10:00Z", "confidence": 1.0,
         "payload": {"compartment": "morning", "expected_window_start": "08:00", "delta_minutes": 10}},
        {"event_type": "breathing_update", "source": "mmwave_mr60bha2", "room": "bedroom",
         "timestamp": "2026-06-11T06:00:00Z", "confidence": 0.93,
         "payload": {"rate_bpm": 16, "in_baseline": False, "overnight_dwell_h": 5.5}},
        {"event_type": "multi_presence_detected", "source": "mmwave_ld2410", "room": "living_room",
         "timestamp": "2026-06-11T10:00:00Z", "confidence": 0.94,
         "payload": {"targets": 2, "motion": "mixed"}},
        copy.deepcopy(distress_ev),
        {"event_type": "location_update", "source": "gps_tracker",
         "timestamp": "2026-06-11T11:00:00Z", "confidence": 0.97,
         "payload": {"lat": 22.5431, "lng": 114.0579, "distance_from_home_m": 620,
                     "trajectory_density_score": 0.91, "baseline_cluster_match": True}},
        {"event_type": "cosine_update", "source": "baseline",
         "timestamp": "2026-06-11T12:00:00Z", "confidence": 1.0,
         "payload": {"cosine_distance": 0.38}},
    ]


SCENARIO_EVENTS: dict[str, list[dict]] = {
    "normal": _events_normal,
    "trend_7day": _events_trend_7day,
    "wandering": _events_wandering,
    "voice_distress": _events_voice_distress,
}


def _run_scenario(name: str) -> dict[str, str]:
    ingestion.reset_state()
    signals.reset()
    events = SCENARIO_EVENTS[name]()
    for ev in events:
        ingestion.process_event(ev)
    return {s: signals.current_states()[s]["state"] for s in SIGNALS}


def _score_all() -> tuple[int, int, list[str]]:
    correct = 0
    total = 0
    lines: list[str] = []
    for scenario in ("normal", "trend_7day", "wandering", "voice_distress"):
        states = _run_scenario(scenario)
        for signal in SIGNALS:
            expected = GROUND_TRUTH[(scenario, signal)]
            actual = states[signal]
            total += 1
            ok = actual == expected
            if ok:
                correct += 1
            mark = "OK" if ok else "MISS"
            gap = " (unreachable amber)" if (scenario, signal) in UNREACHABLE_AMBER else ""
            lines.append(f"  {scenario:14} {signal:16} expected={expected:6} actual={actual:6} [{mark}]{gap}")
    return correct, total, lines


def test_replay_accuracy_gate():
    """PRD §7: ≥26/32 classifications correct."""
    correct, total, lines = _score_all()
    matrix = "\n".join(lines)
    assert correct >= 26, (
        f"Replay gate failed: {correct}/{total} correct (need ≥26).\n"
        f"4×8 matrix:\n{matrix}"
    )


def test_normal_scenario_all_green():
    states = _run_scenario("normal")
    for signal in SIGNALS:
        assert states[signal] == "green", f"normal.{signal}={states[signal]}"
