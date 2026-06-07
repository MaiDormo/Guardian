"""
PRD compliance — route existence, response shapes, performance.

PRD references:
  § 3.2   Module Ownership (route inventory)
  § 1.4   Privacy claim — /status must show on_device + 0 bytes to cloud
  § 7     Demo scenarios — normal, trend_7day, fall
  § 6     Intervention Trigger
  § 12    Performance — overlay <500ms
"""

import time

import pytest

from prd_constants import PRD_SCENARIOS, PRD_SIGNALS


# ── /health ──────────────────────────────────────────────────────────────────

async def test_health_returns_ok(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_health_exposes_fall_active(client):
    r = await client.get("/health")
    assert "fall_active" in r.json()


async def test_health_exposes_client_count(client):
    r = await client.get("/health")
    assert "clients" in r.json()


# ── /status — on-device badge (PRD § 1.4) ───────────────────────────────────

async def test_status_on_device_is_true(client):
    """PRD § 1.4: system must be demonstrably on-device."""
    r = await client.get("/status")
    assert r.status_code == 200
    assert r.json()["on_device"] is True


async def test_status_model_is_gemma4(client):
    """PRD § 4.2: on-device model must be gemma4:e4b."""
    r = await client.get("/status")
    assert r.json()["model"] == "gemma4:e4b"


async def test_status_bytes_to_cloud_is_zero(client):
    """PRD § 1.4: 0 bytes to cloud."""
    r = await client.get("/status")
    assert r.json()["bytes_to_cloud"] == 0


async def test_status_includes_all_8_signals(client):
    """PRD § 5.1: status must expose all 8 signal states."""
    r = await client.get("/status")
    signals = r.json().get("signals", {})
    assert PRD_SIGNALS == set(signals.keys()), (
        f"Missing signals: {PRD_SIGNALS - set(signals.keys())}"
    )


# ── /ingest ───────────────────────────────────────────────────────────────────

async def test_ingest_accepts_presence_event(client):
    """PRD § 5.5: presence_detected must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "bedroom",
        "timestamp": "2026-06-06T07:21:00Z",
        "confidence": 0.97,
        "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"},
    })
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_ingest_accepts_fall_event(client):
    """PRD § 5.5: fall_detected must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "fall_detected",
        "source": "mmwave_mr60fda1",
        "room": "bathroom",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.95,
        "payload": {"posture": "prone", "stationary_s": 12},
    })
    assert r.status_code == 200


async def test_ingest_accepts_voice_checkin(client):
    """PRD § 5.3: voice_checkin_completed must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:05:00Z",
        "confidence": 0.91,
        "payload": {"speech_rate_wpm": 138, "clarity_score": 0.87,
                    "sentiment": "positive", "confusion_markers": False,
                    "response_latency_s": 1.2, "duration_s": 142},
    })
    assert r.status_code == 200


async def test_ingest_accepts_voice_distress(client):
    """PRD § 5.3: voice_distress_detected must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "voice_distress_detected",
        "source": "voice_system",
        "timestamp": "2026-06-06T10:00:00Z",
        "confidence": 0.83,
        "payload": {"speech_rate_wpm": 89, "clarity_score": 0.61,
                    "sentiment": "confused", "confusion_markers": True,
                    "response_latency_s": 4.7, "baseline_deviation_cosine": 0.38},
    })
    assert r.status_code == 200


async def test_ingest_accepts_wandering(client):
    """PRD § 5.4: wandering_detected must be ingestible."""
    r = await client.post("/ingest", json={
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
    assert r.status_code == 200


async def test_ingest_accepts_location_update(client):
    """PRD § 5.4: location_update must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "location_update",
        "source": "gps_tracker",
        "timestamp": "2026-06-06T11:00:00Z",
        "confidence": 0.97,
        "payload": {"lat": 22.5431, "lng": 114.0579,
                    "distance_from_home_m": 620,
                    "trajectory_density_score": 0.91,
                    "baseline_cluster_match": True},
    })
    assert r.status_code == 200


async def test_ingest_accepts_dispenser_opened(client):
    """PRD § 5.7: dispenser_opened must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "dispenser_opened",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T08:10:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "expected_window_start": "08:00", "delta_minutes": 10},
    })
    assert r.status_code == 200


async def test_ingest_accepts_dispenser_missed(client):
    """PRD § 5.7: dispenser_missed must be ingestible."""
    r = await client.post("/ingest", json={
        "event_type": "dispenser_missed",
        "source": "pill_dispenser",
        "timestamp": "2026-06-06T11:00:00Z",
        "confidence": 1.0,
        "payload": {"compartment": "morning",
                    "window_closed_at": "11:00", "minutes_overdue": 120},
    })
    assert r.status_code == 200


async def test_ingest_echoes_event_type(client):
    r = await client.post("/ingest", json={
        "event_type": "presence_detected",
        "source": "mmwave_ld2410",
        "room": "kitchen",
        "timestamp": "2026-06-06T08:00:00Z",
        "confidence": 0.97,
        "payload": {},
    })
    assert r.json()["event_type"] == "presence_detected"


# ── /scenario/{name} (PRD § 7) ───────────────────────────────────────────────

@pytest.mark.parametrize("name", sorted(PRD_SCENARIOS))
async def test_scenario_valid_names_accepted(client, name):
    """PRD § 7: all three scenarios must be selectable."""
    r = await client.post(f"/scenario/{name}")
    assert r.status_code == 200
    assert r.json()["scenario"] == name
    assert r.json()["status"] == "started"


async def test_scenario_invalid_name_returns_400(client):
    r = await client.post("/scenario/made_up_scenario")
    assert r.status_code == 400


async def test_scenario_resets_all_signals_to_unknown(client):
    """PRD § 7: scenario reset must clear previous state."""
    import main
    # Dirty signal state
    for sig in main.SIGNALS:
        main.signal_state[sig]["state"] = "red"

    await client.post("/scenario/normal")

    for sig in main.SIGNALS:
        assert main.signal_state[sig]["state"] == "unknown", (
            f"Signal '{sig}' was not reset after /scenario/normal"
        )


async def test_scenario_resets_fall_active(client):
    import main
    main.fall_active = True
    await client.post("/scenario/normal")
    assert main.fall_active is False


# ── /trigger/intervention (PRD § 6 + § 12) ──────────────────────────────────

async def test_intervention_returns_dispatched_status(client):
    r = await client.post("/trigger/intervention", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "dispatched"


async def test_intervention_includes_overlay_message(client):
    """PRD § 6: overlay must always render, regardless of WhatsApp."""
    r = await client.post("/trigger/intervention", json={})
    assert "overlay_message" in r.json()
    assert len(r.json()["overlay_message"]) > 0


async def test_intervention_includes_timestamp(client):
    r = await client.post("/trigger/intervention", json={})
    assert "timestamp" in r.json()


async def test_intervention_overlay_under_500ms(client):
    """PRD § 12 Performance: Intervention Trigger overlay renders within 500ms."""
    start = time.monotonic()
    r = await client.post("/trigger/intervention", json={})
    elapsed_ms = (time.monotonic() - start) * 1000
    assert r.status_code == 200
    assert elapsed_ms < 500, (
        f"Overlay took {elapsed_ms:.1f}ms — PRD § 12 requires <500ms"
    )


async def test_intervention_overlay_renders_without_whatsapp_token(client):
    """PRD § 6: overlay renders regardless of network / missing WhatsApp config."""
    import main
    original = main.WHATSAPP_TOKEN
    main.WHATSAPP_TOKEN = ""  # simulate unconfigured
    try:
        r = await client.post("/trigger/intervention", json={})
        assert r.status_code == 200
        assert "overlay_message" in r.json()
    finally:
        main.WHATSAPP_TOKEN = original


async def test_intervention_message_preview_contains_location(client):
    """PRD § 6: overlay format includes location."""
    r = await client.post("/trigger/intervention",
                          json={"location": "Shenzhen"})
    assert "Shenzhen" in r.json()["message_preview"]


async def test_fall_scenario_auto_dispatches_alert(client, monkeypatch):
    """Safety-reflex: fall_detected must auto-dispatch without manual trigger."""
    import asyncio
    import main

    dispatched: list[str] = []

    async def fake_dispatch(message: str) -> str:
        dispatched.append(message)
        return "overlay_only"

    monkeypatch.setattr(main, "_dispatch_alert", fake_dispatch)
    monkeypatch.setattr(main, "AUTO_DISPATCH_ON_FALL", True)

    r = await client.post("/scenario/fall")
    assert r.status_code == 200

    if main._scenario_task:
        await main._scenario_task

    assert len(dispatched) == 1
    assert "FALL ALERT" in dispatched[0]
    assert "bathroom" in dispatched[0]
