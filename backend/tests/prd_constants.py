"""PRD-defined constants used across all compliance tests."""

# PRD § 5.6 — canonical SSE event types
PRD_SSE_EVENT_TYPES = {
    "signal_update", "presence_update", "location_update",
    "wandering_detected", "fall_detected", "reasoning_update",
    "intervention_ack", "state_reset", "ping",
}

# PRD § 5.1 — the 8 signals
PRD_SIGNALS = {
    "woke_up", "ate", "took_meds", "rested_well",
    "helper_present", "voice_checkin", "location", "routine",
}

# PRD § 5.2 — valid signal states
PRD_STATES = {"green", "amber", "red", "unknown"}

# PRD § 5.6 — valid room values for presence_update
PRD_ROOMS = {"bedroom", "bathroom", "kitchen", "living_room"}

# PRD § 7 — the three demo scenarios
PRD_SCENARIOS = {"normal", "trend_7day", "fall"}
