"""Structural tests for synthetic voice corpus files."""

import json
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
_SYNTH = _ROOT / "data" / "synthetic"

VOICE_KEYS = {
    "speech_rate_wpm",
    "clarity_score",
    "sentiment",
    "confusion_markers",
    "response_latency_s",
    "duration_s",
}


def _load(name: str) -> dict:
    with open(_SYNTH / name) as f:
        return json.load(f)


def test_voice_normal_has_30_events():
    data = _load("voice_normal.json")
    events = data["events"]
    assert len(events) == 30
    assert data["_meta"]["date_range"] == "2026-05-07..2026-06-05"


def test_voice_normal_schema_keys_only():
    data = _load("voice_normal.json")
    for evt in data["events"]:
        assert evt["event_type"] == "voice_checkin_completed"
        assert evt["source"] == "voice_system"
        assert "room" not in evt
        assert set(evt["payload"].keys()) == VOICE_KEYS


def test_voice_normal_value_ranges():
    data = _load("voice_normal.json")
    for evt in data["events"]:
        p = evt["payload"]
        assert 130 <= p["speech_rate_wpm"] <= 145
        assert 0.82 <= p["clarity_score"] <= 0.90
        assert 1.0 <= p["response_latency_s"] <= 1.6
        assert p["confusion_markers"] is False


def test_voice_distress_day7_matches_trend_7day():
    distress = _load("voice_distress.json")
    trend = _load("trend_7day.json")
    day7_distress = distress["days"][-1]["events"][0]
    day7_trend = None
    for day in trend["days"]:
        if day["day"] == 7:
            for ev in day["events"]:
                if ev["event_type"] == "voice_distress_detected":
                    day7_trend = ev
    assert day7_trend is not None
    assert day7_distress == day7_trend


def test_voice_distress_day7_payload_values():
    data = _load("voice_distress.json")
    ev = data["days"][-1]["events"][0]
    p = ev["payload"]
    assert p["speech_rate_wpm"] == 89
    assert p["clarity_score"] == 0.61
    assert p["sentiment"] == "confused"
    assert p["confusion_markers"] is True
    assert p["response_latency_s"] == 4.7
    assert p["baseline_deviation_cosine"] == 0.38
