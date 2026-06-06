"""
PRD compliance — agent.py and mock_server.py.

Agent tests:
  § 4.2  Hybrid Inference Strategy — cached reasoning must cover all demo scenarios
  § 5.2  Fall: priority_red — fall interrupt must bypass the LLM
  § 5.6  reasoning_update schema — cached entries must have all required fields

Mock server tests:
  § 7    All three scenarios defined: normal, trend_7day, fall
  § 5.6  All SSE events emitted by mock_server match the PRD § 5.6 schema
  § 8    Normal scenario must cover all 8 signals
         Trend scenario must produce red states and wandering
         Fall scenario must fire immediately (delay 0)
"""

import pytest

from prd_constants import PRD_ROOMS, PRD_SCENARIOS, PRD_SIGNALS, PRD_STATES


# ── agent.py: cached reasoning coverage ──────────────────────────────────────

def test_cache_covers_normal_routine():
    """PRD § 4.2: cached reasoning must exist for normal/routine/green."""
    from agent import _CACHE
    assert ("normal", "routine", "green") in _CACHE


def test_cache_covers_normal_location():
    from agent import _CACHE
    assert ("normal", "location", "green") in _CACHE


def test_cache_covers_trend_voice_red():
    """PRD § 7 Scenario B: voice red must have cached reasoning."""
    from agent import _CACHE
    assert ("trend_7day", "voice_checkin", "red") in _CACHE


def test_cache_covers_trend_location_red():
    """PRD § 7 Scenario B: location red must have cached reasoning."""
    from agent import _CACHE
    assert ("trend_7day", "location", "red") in _CACHE


def test_cache_covers_trend_routine_red():
    """PRD § 7 Scenario B: routine red (cosine 0.38) must have cached reasoning."""
    from agent import _CACHE
    assert ("trend_7day", "routine", "red") in _CACHE


def test_cache_covers_fall_interrupt():
    """PRD § 4.2 / § 5.2: fall interrupt must have immediate cached reasoning."""
    from agent import _CACHE
    assert ("fall", "fall_detected", "priority_red") in _CACHE


def test_every_cache_entry_has_required_fields():
    """PRD § 5.6 reasoning_update: each cached entry must have all payload fields."""
    from agent import _CACHE
    required = {"cosine_distance", "baseline_window_days",
                "features_considered", "rationale"}
    for key, entry in _CACHE.items():
        missing = required - set(entry.keys())
        assert not missing, (
            f"Cache entry {key} is missing fields: {missing}"
        )


def test_every_cache_entry_has_non_empty_rationale():
    from agent import _CACHE
    for key, entry in _CACHE.items():
        assert isinstance(entry["rationale"], str) and len(entry["rationale"]) > 10, (
            f"Cache entry {key} has empty or missing rationale"
        )


def test_every_cache_entry_has_features_list():
    from agent import _CACHE
    for key, entry in _CACHE.items():
        assert isinstance(entry["features_considered"], list), (
            f"Cache entry {key}: features_considered must be a list"
        )
        assert len(entry["features_considered"]) >= 1, (
            f"Cache entry {key}: features_considered must not be empty"
        )


def test_cached_signal_names_are_valid():
    """Cached signal names must be in the PRD § 5.1 signal list, fall_detected,
    or the advisory 'connection_window' key (not a health signal)."""
    from agent import _CACHE
    valid = PRD_SIGNALS | {"fall_detected", "connection_window"}
    for (_, signal, _) in _CACHE:
        assert signal in valid, (
            f"Cache key uses unknown signal '{signal}' — not in PRD § 5.1"
        )


# ── agent.py: fall interrupt ──────────────────────────────────────────────────

async def test_fall_interrupt_broadcasts_reasoning_update():
    """PRD § 5.2: fall interrupt must emit reasoning_update immediately."""
    from agent import GuardianAgent

    emitted = []

    async def mock_broadcast(event: dict) -> None:
        emitted.append(event)

    agent = GuardianAgent(broadcast=mock_broadcast)
    await agent.fall_interrupt(
        room="bathroom", posture="prone", stationary_s=12, confidence=0.95
    )

    reasoning_events = [e for e in emitted if e.get("event") == "reasoning_update"]
    assert len(reasoning_events) >= 1, "Fall interrupt must emit reasoning_update"


async def test_fall_interrupt_reasoning_has_required_fields():
    """PRD § 5.6: reasoning_update payload must have all required fields."""
    from agent import GuardianAgent

    emitted = []

    async def mock_broadcast(event: dict) -> None:
        emitted.append(event)

    agent = GuardianAgent(broadcast=mock_broadcast)
    await agent.fall_interrupt(
        room="bathroom", posture="prone", stationary_s=12, confidence=0.95
    )

    reasoning = [e for e in emitted if e.get("event") == "reasoning_update"][0]
    p = reasoning["payload"]
    required = {"signal", "features_considered", "rationale", "updated_at"}
    missing = required - set(p.keys())
    assert not missing, f"reasoning_update payload missing: {missing}"


async def test_fall_interrupt_does_not_call_ollama():
    """PRD § 5.2: fall bypass — LLM must not be called for fall interrupt."""
    from agent import GuardianAgent

    agent = GuardianAgent()
    agent._ollama_ok = True  # pretend Ollama is up

    live_called = []
    original = agent._live_assess

    async def patched(*args, **kwargs):
        live_called.append(True)
        return await original(*args, **kwargs)

    agent._live_assess = patched

    async def noop(event):
        pass

    agent.broadcast = noop
    await agent.fall_interrupt("bathroom", "prone", 12, 0.95)

    assert not live_called, "Fall interrupt must not invoke live LLM reasoning"


# ── agent.py: tool dispatch ───────────────────────────────────────────────────

def test_tool_dispatch_get_signal_states_returns_dict():
    from agent import GuardianAgent
    agent = GuardianAgent()
    agent._signal_state = {"woke_up": {"state": "green"}}
    result = agent._dispatch_tool("get_signal_states", {})
    import json
    data = json.loads(result)
    assert "woke_up" in data


def test_tool_dispatch_get_cosine_distance_returns_signal():
    from agent import GuardianAgent
    agent = GuardianAgent()
    agent._signal_state = {"routine": {"state": "red", "cosine_distance": 0.38}}
    result = agent._dispatch_tool("get_cosine_distance", {"signal": "routine"})
    import json
    data = json.loads(result)
    assert data["signal"] == "routine"
    assert "cosine_distance" in data


def test_tool_dispatch_get_recent_events_returns_hours():
    from agent import GuardianAgent
    agent = GuardianAgent()
    result = agent._dispatch_tool("get_recent_events", {"hours": 4})
    import json
    data = json.loads(result)
    assert data["hours"] == 4


def test_tool_dispatch_unknown_tool_returns_error():
    from agent import GuardianAgent
    agent = GuardianAgent()
    result = agent._dispatch_tool("totally_fake_tool", {})
    import json
    data = json.loads(result)
    assert "error" in data


# ── mock_server.py: scenario coverage (PRD § 7) ──────────────────────────────

def test_mock_server_defines_all_three_scenarios():
    """PRD § 7: mock_server must define normal, trend_7day, fall."""
    from mock_server import SCENARIOS
    assert PRD_SCENARIOS == set(SCENARIOS.keys()), (
        f"Missing scenarios: {PRD_SCENARIOS - set(SCENARIOS.keys())}"
    )


def test_mock_server_normal_scenario_is_non_empty():
    from mock_server import SCENARIO_NORMAL
    assert len(SCENARIO_NORMAL) >= 5, "Normal scenario must have meaningful events"


def test_mock_server_trend_scenario_is_non_empty():
    from mock_server import SCENARIO_TREND
    assert len(SCENARIO_TREND) >= 10, "Trend scenario must cover 7 days of events"


def test_mock_server_fall_scenario_is_non_empty():
    from mock_server import SCENARIO_FALL
    assert len(SCENARIO_FALL) >= 1


# ── mock_server.py: event schema compliance (PRD § 5.6) ──────────────────────

def _all_mock_events() -> list[dict]:
    """Return every SSE event across all mock_server scenarios."""
    from mock_server import SCENARIOS
    return [event for events in SCENARIOS.values() for _, event in events]


def test_all_mock_events_have_event_field():
    """Every mock SSE event must have an 'event' key (PRD § 5.6)."""
    for event in _all_mock_events():
        assert "event" in event, f"Mock event missing 'event' field: {event}"


def test_all_mock_events_have_payload_field():
    """Every mock SSE event must have a 'payload' key (PRD § 5.6)."""
    for event in _all_mock_events():
        assert "payload" in event, f"Mock event missing 'payload' field: {event}"


def test_mock_signal_update_events_have_required_fields():
    """PRD § 5.6: every signal_update in mock must have all required fields."""
    required = {"signal", "state", "reason", "cosine_distance", "updated_at"}
    for event in _all_mock_events():
        if event.get("event") == "signal_update":
            missing = required - set(event["payload"].keys())
            assert not missing, (
                f"mock signal_update missing fields {missing}: {event['payload']}"
            )


def test_mock_signal_names_are_valid():
    """PRD § 5.6: signal_update.signal must be in the 8-signal list."""
    for event in _all_mock_events():
        if event.get("event") == "signal_update":
            signal = event["payload"]["signal"]
            assert signal in PRD_SIGNALS, (
                f"Mock emits unknown signal '{signal}' — not in PRD § 5.1"
            )


def test_mock_signal_states_are_valid():
    """PRD § 5.2: signal_update.state must be green / amber / red / unknown."""
    for event in _all_mock_events():
        if event.get("event") == "signal_update":
            state = event["payload"]["state"]
            assert state in PRD_STATES, (
                f"Mock emits invalid state '{state}' — PRD states: {PRD_STATES}"
            )


def test_mock_presence_update_rooms_are_valid():
    """PRD § 5.6: presence_update.room must be one of the four PRD rooms."""
    for event in _all_mock_events():
        if event.get("event") == "presence_update":
            room = event["payload"]["room"]
            assert room in PRD_ROOMS, (
                f"Mock emits invalid room '{room}' — PRD rooms: {PRD_ROOMS}"
            )


def test_mock_presence_update_has_required_fields():
    """PRD § 5.6: presence_update must have room, occupied, fall, updated_at."""
    required = {"room", "occupied", "fall", "updated_at"}
    for event in _all_mock_events():
        if event.get("event") == "presence_update":
            missing = required - set(event["payload"].keys())
            assert not missing, (
                f"mock presence_update missing fields {missing}: {event['payload']}"
            )


def test_mock_reasoning_update_has_required_fields():
    """PRD § 5.6: reasoning_update must have all required fields."""
    required = {"signal", "cosine_distance", "baseline_window_days",
                "features_considered", "rationale", "updated_at"}
    for event in _all_mock_events():
        if event.get("event") == "reasoning_update":
            missing = required - set(event["payload"].keys())
            assert not missing, (
                f"mock reasoning_update missing fields {missing}: {event['payload']}"
            )


def test_mock_fall_scenario_has_fall_detected_event():
    """PRD § 7 Scenario C: fall scenario must contain a fall_detected event."""
    from mock_server import SCENARIO_FALL
    fall_events = [e for _, e in SCENARIO_FALL if e.get("event") == "fall_detected"]
    assert len(fall_events) >= 1, "Fall scenario must emit fall_detected"


def test_mock_fall_scenario_fires_immediately():
    """PRD § 7 Scenario C: fall is a hard-cut — must fire at delay 0."""
    from mock_server import SCENARIO_FALL
    first_delay = SCENARIO_FALL[0][0]
    assert first_delay == 0.0, (
        f"Fall scenario first event delay is {first_delay}s — must be 0 (immediate)"
    )


def test_mock_normal_scenario_covers_all_8_signals():
    """PRD § 8 Act 1: normal scenario must turn all 8 cards green."""
    from mock_server import SCENARIO_NORMAL
    signalled = {
        e["payload"]["signal"]
        for _, e in SCENARIO_NORMAL
        if e.get("event") == "signal_update"
    }
    missing = PRD_SIGNALS - signalled
    assert not missing, (
        f"Normal scenario does not cover signals: {missing}"
    )


def test_mock_trend_scenario_produces_red_states():
    """PRD § 7 Scenario B: trend scenario must have at least one red state."""
    from mock_server import SCENARIO_TREND
    red_signals = [
        e for _, e in SCENARIO_TREND
        if e.get("event") == "signal_update"
        and e["payload"].get("state") == "red"
    ]
    assert len(red_signals) >= 1, "Trend scenario must produce at least one red signal"


def test_mock_trend_scenario_has_wandering():
    """PRD § 7 Scenario B: trend scenario must emit wandering_detected."""
    from mock_server import SCENARIO_TREND
    wander = [e for _, e in SCENARIO_TREND if e.get("event") == "wandering_detected"]
    assert len(wander) >= 1, "Trend scenario must emit wandering_detected"


def test_mock_trend_wandering_has_required_fields():
    """PRD § 5.6: wandering_detected payload must have all required fields."""
    from mock_server import SCENARIO_TREND
    required = {"trajectory_density_score", "baseline_cluster_match",
                "minutes_outside_baseline_footprint", "updated_at"}
    for _, e in SCENARIO_TREND:
        if e.get("event") == "wandering_detected":
            missing = required - set(e["payload"].keys())
            assert not missing, f"wandering_detected missing fields: {missing}"
