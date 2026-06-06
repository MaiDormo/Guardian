"""Shared fixtures for all PRD compliance tests."""

import pytest
from httpx import AsyncClient, ASGITransport

# PRD § 5.6 — canonical SSE event types
PRD_SSE_EVENT_TYPES = {
    "signal_update", "presence_update", "location_update",
    "wandering_detected", "fall_detected", "reasoning_update",
    "intervention_ack", "state_reset", "ping",
}

# PRD § 5.6 — valid signal names
PRD_SIGNALS = {
    "woke_up", "ate", "took_meds", "rested_well",
    "helper_present", "voice_checkin", "location", "routine",
}

# PRD § 5.2 — valid signal states
PRD_STATES = {"green", "amber", "red", "unknown"}

# PRD § 5.6 — valid room values
PRD_ROOMS = {"bedroom", "bathroom", "kitchen", "living_room"}

# PRD § 7 — the three demo scenarios
PRD_SCENARIOS = {"normal", "trend_7day", "fall"}


@pytest.fixture(autouse=True)
def reset_main_state():
    """Reset main.py in-memory state before every test."""
    import main
    main.signal_state = main._empty_state()
    main.fall_active = False
    # Cancel any background scenario task left over from a previous test
    if main._scenario_task and not main._scenario_task.done():
        main._scenario_task.cancel()
    main._scenario_task = None
    yield
    main.signal_state = main._empty_state()
    main.fall_active = False


@pytest.fixture
async def client():
    """Async HTTP client bound to the FastAPI app — no server required."""
    import main
    async with AsyncClient(
        transport=ASGITransport(app=main.app), base_url="http://test"
    ) as c:
        yield c
