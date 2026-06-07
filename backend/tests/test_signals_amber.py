"""Amber-timeout machine and took_meds time-window rules."""

import ingestion
import signals
from tests.replay import _run_scenario


def _process(event: dict) -> None:
    ingestion.reset_state()
    signals.reset()
    ingestion.process_event(event)


def test_took_meds_no_dispenser_by_11_is_amber():
    ingestion.reset_state()
    signals.reset()
    ingestion.process_event({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-07T11:30:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 600, "motion": "stationary"},
    })
    assert signals.current_states()["took_meds"]["state"] == "amber"


def test_took_meds_late_open_delta_is_amber():
    ingestion.reset_state()
    signals.reset()
    ingestion.process_event({
        "event_type": "dispenser_opened",
        "source": "pill_dispenser",
        "timestamp": "2026-06-07T10:52:00Z",
        "confidence": 1.0,
        "payload": {
            "compartment": "morning",
            "expected_window_start": "08:00",
            "delta_minutes": 172,
        },
    })
    assert signals.current_states()["took_meds"]["state"] == "amber"


def test_took_meds_amber_escalates_to_red_after_active_timeout():
    ingestion.reset_state()
    signals.reset()
    ingestion.process_event({
        "event_type": "dispenser_missed",
        "source": "pill_dispenser",
        "timestamp": "2026-06-07T13:00:00Z",
        "confidence": 1.0,
        "payload": {
            "compartment": "morning",
            "window_closed_at": "11:00",
            "minutes_overdue": 60,
        },
    })
    assert signals.current_states()["took_meds"]["state"] == "amber"

    ingestion.process_event({
        "event_type": "cosine_update",
        "source": "baseline",
        "timestamp": "2026-06-07T15:01:00Z",
        "confidence": 1.0,
        "payload": {"cosine_distance": 0.04},
    })
    assert signals.current_states()["took_meds"]["state"] == "red"


def test_trend_7day_took_meds_scores_amber():
    states = _run_scenario("trend_7day")
    assert states["took_meds"] == "amber"
