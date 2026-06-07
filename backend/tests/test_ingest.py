"""
PRD compliance — ingest event processing and SSE event schema.

Every event type from PRD §§ 5.3–5.7 must:
  1. Be accepted by /ingest (200 OK)
  2. Produce SSE events whose payloads match the schema in PRD § 5.6
  3. Update the correct signal with a valid state value

Tests call _process_event_inplace() directly so they are synchronous, fast,
and don't require an SSE client.
"""

import pytest

from prd_constants import PRD_ROOMS, PRD_SIGNALS, PRD_STATES


# ── helpers ──────────────────────────────────────────────────────────────────

async def process(event: dict) -> list[dict]:
    """Call main._process_event_inplace and return the resulting SSE events."""
    import main
    return await main._process_event_inplace(event)


def events_of_type(sse_events: list[dict], event_type: str) -> list[dict]:
    return [e for e in sse_events if e.get("event") == event_type]


def assert_signal_update_schema(event: dict) -> None:
    """PRD § 5.6: signal_update must have all required fields."""
    p = event["payload"]
    assert "signal" in p,          "signal_update missing 'signal'"
    assert "state" in p,           "signal_update missing 'state'"
    assert "reason" in p,          "signal_update missing 'reason'"
    assert "updated_at" in p,      "signal_update missing 'updated_at'"
    assert "cosine_distance" in p, "signal_update missing 'cosine_distance'"


def assert_presence_update_schema(event: dict) -> None:
    """PRD § 5.6: presence_update must have all required fields."""
    p = event["payload"]
    assert "room" in p,       "presence_update missing 'room'"
    assert "occupied" in p,   "presence_update missing 'occupied'"
    assert "fall" in p,       "presence_update missing 'fall'"
    assert "updated_at" in p, "presence_update missing 'updated_at'"


def assert_fall_detected_schema(event: dict) -> None:
    """PRD § 5.6: fall_detected must have all required fields."""
    p = event["payload"]
    assert "room" in p,         "fall_detected missing 'room'"
    assert "posture" in p,      "fall_detected missing 'posture'"
    assert "stationary_s" in p, "fall_detected missing 'stationary_s'"
    assert "confidence" in p,   "fall_detected missing 'confidence'"
    assert "updated_at" in p,   "fall_detected missing 'updated_at'"


def assert_wandering_detected_schema(event: dict) -> None:
    """PRD § 5.6: wandering_detected must have all required fields."""
    p = event["payload"]
    assert "trajectory_density_score" in p,           "wandering_detected missing 'trajectory_density_score'"
    assert "baseline_cluster_match" in p,             "wandering_detected missing 'baseline_cluster_match'"
    assert "minutes_outside_baseline_footprint" in p, "wandering_detected missing 'minutes_outside_baseline_footprint'"
    assert "updated_at" in p,                         "wandering_detected missing 'updated_at'"


# ── PRD § 5.5 radar events ───────────────────────────────────────────────────

async def test_presence_detected_emits_presence_update():
    """Radar presence → presence_update SSE with correct schema."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "bedroom",
        "timestamp": "2026-06-06T07:21:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    updates = events_of_type(events, "presence_update")
    assert len(updates) >= 1, "Expected at least one presence_update"
    assert_presence_update_schema(updates[0])


async def test_presence_detected_bedroom_morning_triggers_woke_up():
    """PRD § 5.1: bedroom motion in morning window → woke_up green."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "bedroom",
        "timestamp": "2026-06-06T07:21:00Z",  # 07:21 — morning window
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    sig_updates = events_of_type(events, "signal_update")
    woke_up = [e for e in sig_updates if e["payload"]["signal"] == "woke_up"]
    assert len(woke_up) >= 1, "Expected woke_up signal_update"
    assert woke_up[0]["payload"]["state"] == "green"


async def test_presence_detected_kitchen_with_dwell_triggers_ate():
    """PRD § 5.1: kitchen dwell ≥ 300s → ate green."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-06T08:00:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 1320, "motion": "stationary"},
    })
    sig_updates = events_of_type(events, "signal_update")
    ate = [e for e in sig_updates if e["payload"]["signal"] == "ate"]
    assert len(ate) >= 1, "Expected ate signal_update"
    assert ate[0]["payload"]["state"] == "green"


async def test_presence_detected_kitchen_short_dwell_triggers_amber():
    """PRD § 5.1: kitchen dwell far below baseline → ate amber."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-06T08:00:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 120, "motion": "stationary"},
    })
    sig_updates = events_of_type(events, "signal_update")
    ate = [e for e in sig_updates if e["payload"]["signal"] == "ate"]
    assert len(ate) >= 1, "Expected ate signal_update"
    assert ate[0]["payload"]["state"] == "amber"


async def test_presence_ended_emits_presence_update_not_occupied():
    events = await process({
        "event_type": "presence_ended",
        "source": "mmwave_ld2410",
        "room": "bathroom",
        "timestamp": "2026-06-06T07:56:00Z",
        "confidence": 0.97,
        "payload": {},
    })
    updates = events_of_type(events, "presence_update")
    assert len(updates) >= 1
    assert updates[0]["payload"]["occupied"] is False


async def test_fall_detected_emits_fall_detected_not_signal_update():
    """PRD § 5.2: fall is priority_red — bypasses signal state machine."""
    events = await process({
        "event_type": "fall_detected",
        "source": "mmwave_mr60fda1",
        "room": "bathroom",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.95,
        "payload": {"posture": "prone", "stationary_s": 12},
    })
    fall_events = events_of_type(events, "fall_detected")
    assert len(fall_events) >= 1, "fall_detected must emit fall_detected SSE"
    # Fall must NOT produce a regular signal_update
    sig_updates = events_of_type(events, "signal_update")
    assert len(sig_updates) == 0, (
        "fall_detected must bypass signal state machine (no signal_update)"
    )


async def test_fall_detected_sse_schema():
    """PRD § 5.6: fall_detected SSE payload must have all required fields."""
    events = await process({
        "event_type": "fall_detected",
        "source": "mmwave_mr60fda1",
        "room": "bathroom",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.95,
        "payload": {"posture": "prone", "stationary_s": 12},
    })
    fall_events = events_of_type(events, "fall_detected")
    assert_fall_detected_schema(fall_events[0])


async def test_fall_detected_also_emits_bathroom_presence_pulse():
    """PRD § 8 demo: fall must make bathroom pulse red on floor plan."""
    events = await process({
        "event_type": "fall_detected",
        "source": "mmwave_mr60fda1",
        "room": "bathroom",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.95,
        "payload": {"posture": "prone", "stationary_s": 12},
    })
    presence = events_of_type(events, "presence_update")
    bathroom_pulse = [e for e in presence
                      if e["payload"].get("room") == "bathroom"
                      and e["payload"].get("fall") is True]
    assert len(bathroom_pulse) >= 1, (
        "fall_detected must emit presence_update room=bathroom fall=True"
    )


async def test_fall_sets_fall_active_flag():
    """PRD § 5.2: fall_active flag must be set for /health to report correctly."""
    import main
    assert main.fall_active is False
    await process({
        "event_type": "fall_detected",
        "source": "mmwave_mr60fda1",
        "room": "bathroom",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.95,
        "payload": {"posture": "prone", "stationary_s": 12},
    })
    assert main.fall_active is True


# ── PRD § 5.3 voice events ────────────────────────────────────────────────────

async def test_voice_checkin_normal_triggers_green():
    """PRD § 5.1: normal voice check-in → voice_checkin green."""
    events = await process({
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:05:00Z",
        "confidence": 0.91,
        "payload": {"speech_rate_wpm": 138, "clarity_score": 0.87,
                    "sentiment": "positive", "confusion_markers": False,
                    "response_latency_s": 1.2, "duration_s": 142},
    })
    sig_updates = events_of_type(events, "signal_update")
    vc = [e for e in sig_updates if e["payload"]["signal"] == "voice_checkin"]
    assert len(vc) >= 1
    assert vc[0]["payload"]["state"] == "green"


async def test_voice_checkin_mild_clarity_triggers_amber():
    """Day 5 trend: clarity drop without confusion → voice_checkin amber."""
    events = await process({
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:05:00Z",
        "confidence": 0.88,
        "payload": {"speech_rate_wpm": 105, "clarity_score": 0.68,
                    "sentiment": "neutral", "confusion_markers": False,
                    "response_latency_s": 2.9, "duration_s": 110},
    })
    sig_updates = events_of_type(events, "signal_update")
    vc = [e for e in sig_updates if e["payload"]["signal"] == "voice_checkin"]
    assert len(vc) >= 1
    assert vc[0]["payload"]["state"] == "amber"


async def test_voice_checkin_confused_triggers_red():
    """PRD § 5.1: confusion markers → voice_checkin red."""
    events = await process({
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:05:00Z",
        "confidence": 0.87,
        "payload": {"speech_rate_wpm": 89, "clarity_score": 0.61,
                    "sentiment": "confused", "confusion_markers": True,
                    "response_latency_s": 4.7, "duration_s": 98},
    })
    sig_updates = events_of_type(events, "signal_update")
    vc = [e for e in sig_updates if e["payload"]["signal"] == "voice_checkin"]
    assert len(vc) >= 1
    assert vc[0]["payload"]["state"] == "red"


async def test_voice_distress_triggers_red():
    """PRD § 5.3: voice_distress_detected → voice_checkin red."""
    events = await process({
        "event_type": "voice_distress_detected",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.83,
        "payload": {"speech_rate_wpm": 89, "clarity_score": 0.61,
                    "sentiment": "confused", "confusion_markers": True,
                    "response_latency_s": 4.7, "baseline_deviation_cosine": 0.38},
    })
    sig_updates = events_of_type(events, "signal_update")
    vc = [e for e in sig_updates if e["payload"]["signal"] == "voice_checkin"]
    assert len(vc) >= 1
    assert vc[0]["payload"]["state"] == "red"


# ── PRD § 5.4 location events ─────────────────────────────────────────────────

async def test_location_update_normal_triggers_green():
    """PRD § 5.1: baseline_cluster_match=True → location green."""
    events = await process({
        "event_type": "location_update",
        "source": "gps_tracker",
        "timestamp": "2026-06-06T11:00:00Z",
        "confidence": 0.97,
        "payload": {"lat": 22.5431, "lng": 114.0579,
                    "distance_from_home_m": 620,
                    "trajectory_density_score": 0.91,
                    "baseline_cluster_match": True},
    })
    sig_updates = events_of_type(events, "signal_update")
    loc = [e for e in sig_updates if e["payload"]["signal"] == "location"]
    assert len(loc) >= 1
    assert loc[0]["payload"]["state"] == "green"


async def test_wandering_triggers_location_red():
    """PRD § 5.1: wandering_detected → location red."""
    events = await process({
        "event_type": "wandering_detected",
        "source": "gps_tracker",
        "timestamp": "2026-06-06T10:15:00Z",
        "confidence": 0.88,
        "payload": {"lat": 22.5512, "lng": 114.0701,
                    "distance_from_home_m": 1800,
                    "trajectory_density_score": 0.09,
                    "baseline_cluster_match": False,
                    "minutes_outside_baseline_footprint": 34},
    })
    sig_updates = events_of_type(events, "signal_update")
    loc = [e for e in sig_updates if e["payload"]["signal"] == "location"]
    assert len(loc) >= 1
    assert loc[0]["payload"]["state"] == "red"


async def test_wandering_emits_wandering_detected_sse():
    """PRD § 5.6: wandering_detected ingest must produce wandering_detected SSE."""
    events = await process({
        "event_type": "wandering_detected",
        "source": "gps_tracker",
        "timestamp": "2026-06-06T10:15:00Z",
        "confidence": 0.88,
        "payload": {"lat": 22.5512, "lng": 114.0701,
                    "distance_from_home_m": 1800,
                    "trajectory_density_score": 0.09,
                    "baseline_cluster_match": False,
                    "minutes_outside_baseline_footprint": 34},
    })
    wander_events = events_of_type(events, "wandering_detected")
    assert len(wander_events) >= 1
    assert_wandering_detected_schema(wander_events[0])


# ── PRD § 5.7 dispenser events ────────────────────────────────────────────────

async def test_dispenser_opened_triggers_took_meds_green():
    """PRD § 5.1: dispenser_opened → took_meds green."""
    events = await process({
        "event_type": "dispenser_opened",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T08:10:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "expected_window_start": "08:00", "delta_minutes": 10},
    })
    sig_updates = events_of_type(events, "signal_update")
    meds = [e for e in sig_updates if e["payload"]["signal"] == "took_meds"]
    assert len(meds) >= 1
    assert meds[0]["payload"]["state"] == "green"


async def test_dispenser_missed_triggers_took_meds_red():
    """PRD § 5.1: dispenser_missed → took_meds red."""
    events = await process({
        "event_type": "dispenser_missed",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T11:00:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "window_closed_at": "11:00", "minutes_overdue": 120},
    })
    sig_updates = events_of_type(events, "signal_update")
    meds = [e for e in sig_updates if e["payload"]["signal"] == "took_meds"]
    assert len(meds) >= 1
    assert meds[0]["payload"]["state"] == "red"


async def test_cosine_update_triggers_routine_signal():
    """PRD § 5.1: cosine_update → routine signal state changes."""
    events = await process({
        "event_type": "cosine_update",
        "source": "baseline",
        "timestamp": "2026-06-06T13:00:00Z",
        "confidence": 1.0,
        "payload": {"cosine_distance": 0.04},
    })
    sig_updates = events_of_type(events, "signal_update")
    routine = [e for e in sig_updates if e["payload"]["signal"] == "routine"]
    assert len(routine) >= 1


async def test_cosine_above_threshold_triggers_routine_red():
    """PRD § 5.2: cosine > 0.25 → routine red."""
    events = await process({
        "event_type": "cosine_update",
        "source": "baseline",
        "timestamp": "2026-06-06T13:00:00Z",
        "confidence": 1.0,
        "payload": {"cosine_distance": 0.38},
    })
    sig_updates = events_of_type(events, "signal_update")
    routine = [e for e in sig_updates if e["payload"]["signal"] == "routine"]
    assert len(routine) >= 1
    assert routine[0]["payload"]["state"] == "red"


# ── SSE schema field validation (PRD § 5.6) ──────────────────────────────────

async def test_all_signal_update_fields_present():
    """Every signal_update from ingest must have the fields defined in PRD § 5.6."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "bedroom",
        "timestamp": "2026-06-06T07:21:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    for e in events_of_type(events, "signal_update"):
        assert_signal_update_schema(e)


async def test_all_presence_update_fields_present():
    """Every presence_update from ingest must have the fields in PRD § 5.6."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-06T08:00:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    for e in events_of_type(events, "presence_update"):
        assert_presence_update_schema(e)


async def test_signal_update_state_is_valid_prd_value():
    """PRD § 5.2: state must be one of green / amber / red / unknown."""
    events = await process({
        "event_type": "dispenser_opened",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T08:10:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "expected_window_start": "08:00", "delta_minutes": 10},
    })
    for e in events_of_type(events, "signal_update"):
        state = e["payload"]["state"]
        assert state in PRD_STATES, (
            f"Signal state '{state}' is not a valid PRD value: {PRD_STATES}"
        )


async def test_signal_update_signal_name_is_valid():
    """signal_update.signal must be one of the 8 PRD signals."""
    events = await process({
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:05:00Z",
        "confidence": 0.91,
        "payload": {"speech_rate_wpm": 138, "clarity_score": 0.87,
                    "sentiment": "positive", "confusion_markers": False,
                    "response_latency_s": 1.2, "duration_s": 142},
    })
    for e in events_of_type(events, "signal_update"):
        signal = e["payload"]["signal"]
        assert signal in PRD_SIGNALS, (
            f"Unknown signal name '{signal}' — not in PRD § 5.1"
        )


async def test_presence_update_room_is_valid():
    """presence_update.room must be one of the four PRD room values."""
    events = await process({
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-06T08:00:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    for e in events_of_type(events, "presence_update"):
        room = e["payload"]["room"]
        assert room in PRD_ROOMS, (
            f"Room value '{room}' is not a valid PRD room: {PRD_ROOMS}"
        )


# ── Signal state persistence ──────────────────────────────────────────────────

async def test_ingest_updates_module_signal_state():
    """Processing an event must persist state in main.signal_state."""
    import main
    assert main.signal_state["took_meds"]["state"] == "unknown"

    await process({
        "event_type": "dispenser_opened",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T08:10:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "expected_window_start": "08:00", "delta_minutes": 10},
    })
    assert main.signal_state["took_meds"]["state"] == "green"


async def test_all_8_signals_start_as_unknown():
    """PRD § 5.2 cold-start: all signals unknown on fresh state."""
    import main
    for sig in PRD_SIGNALS:
        assert main.signal_state[sig]["state"] == "unknown", (
            f"Signal '{sig}' should start as unknown"
        )


async def test_ingest_and_broadcast_syncs_signal_state():
    """
    Regression: _ingest_and_broadcast must update signal_state regardless of
    whether HAS_TANMAY is True or False. Before the fix, Tanmay's code path
    skipped _make_signal_sse, leaving signal_state stuck at 'unknown' while
    broadcasting the correct SSE events — /status badge showed all-unknown
    and agent.maybe_assess silently stopped firing.
    """
    import main

    broadcast_received: list[dict] = []

    async def capture(event: dict) -> None:
        broadcast_received.append(event)

    # Patch _clients so _broadcast calls our capture
    original_clients = main._clients[:]
    import asyncio
    q: asyncio.Queue = asyncio.Queue()
    main._clients.append(q)

    try:
        await main._ingest_and_broadcast({
            "event_type": "dispenser_opened",
            "source": "pill_dispenser",
            "timestamp": "2026-06-06T08:10:00Z",
            "confidence": 1.0,
            "payload": {"compartment": "morning",
                        "expected_window_start": "08:00", "delta_minutes": 10},
        })

        # signal_state must be updated — not just the SSE broadcast
        assert main.signal_state["took_meds"]["state"] == "green", (
            "signal_state not synced after _ingest_and_broadcast — "
            "agent.maybe_assess and /status would see 'unknown' instead of 'green'"
        )
    finally:
        main._clients.remove(q)


async def test_ingest_and_broadcast_sets_fall_active():
    """
    Regression: fall_active must be set by _ingest_and_broadcast regardless of
    whether HAS_TANMAY is True or False. Previously only set inside
    _process_event_inplace (fallback). Consequence: /health badge showed
    fall_active=false and the bathroom SVG pulse never fired on the dashboard.
    """
    import asyncio
    import main

    assert main.fall_active is False
    q: asyncio.Queue = asyncio.Queue()
    main._clients.append(q)
    try:
        await main._ingest_and_broadcast({
            "event_type": "fall_detected",
            "source": "mmwave_mr60fda1",
            "room": "bathroom",
            "timestamp": "2026-06-06T10:00:00Z",
            "confidence": 0.95,
            "payload": {"posture": "prone", "stationary_s": 12},
        })
        assert main.fall_active is True, (
            "fall_active not set — /health badge wrong and bathroom pulse broken "
            "when HAS_TANMAY=True"
        )
    finally:
        main._clients.remove(q)
