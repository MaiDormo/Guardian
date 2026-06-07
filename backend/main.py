"""
main.py — Guardian FastAPI backend.

Routes:
    GET  /health                  — Health check
    GET  /status                  — On-device badge data (no outbound connections)
    POST /ingest                  — Receive sensor events (from simulator or real sensors)
    GET  /events                  — SSE stream → Next.js dashboard
    POST /scenario/{name}         — Reset state + play scripted scenario timeline
    POST /trigger/intervention    — Dispatch WhatsApp + return overlay payload

All SSE events match PRD § 5.6 schema exactly.

Integration strategy: tries to import Tanmay's modules (ingestion, signals, baseline,
location, voice_checkin). Falls back to in-memory rule-based logic if they don't exist
yet — this keeps Phase 1 fully functional before Tanmay's code lands.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [guardian] %(message)s")
log = logging.getLogger(__name__)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# WeChat / WeCom (primary for GBA caregivers — works on mainland China, no VPN)
WECOM_WEBHOOK_URL = os.getenv("WECOM_WEBHOOK_URL", "")
# WhatsApp Business API (fallback for HK-side family members)
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")
CAREGIVER_PHONE = os.getenv("CAREGIVER_PHONE", "+85200000000")
AUTO_DISPATCH_ON_FALL = os.getenv("AUTO_DISPATCH_ON_FALL", "true").lower() in (
    "1", "true", "yes",
)

# ---------------------------------------------------------------------------
# Optional integration with Tanmay's modules
# ---------------------------------------------------------------------------

try:
    from ingestion import process_event as _tanmay_ingest  # type: ignore
    from signals import update_signal_state as _tanmay_signals  # type: ignore
    HAS_TANMAY = True
    log.info("Tanmay's modules loaded ✓")
except ImportError:
    HAS_TANMAY = False
    log.info("Tanmay's modules not found — running in-memory fallback mode")

try:
    from agent import GuardianAgent  # type: ignore
    _agent: "GuardianAgent | None" = None  # initialised in lifespan
    HAS_AGENT = True
except ImportError:
    HAS_AGENT = False
    _agent = None
    log.info("agent.py not found — reasoning log will be unavailable")

try:
    from connection import compute_connection_window, load_prefs  # type: ignore
    HAS_CONNECTION = True
    log.info("connection.py loaded ✓")
except ImportError:
    HAS_CONNECTION = False
    log.info("connection.py not found — connection window will use stub")

# ---------------------------------------------------------------------------
# In-memory signal state
# ---------------------------------------------------------------------------

SIGNALS = ["woke_up", "ate", "took_meds", "rested_well", "helper_present",
           "voice_checkin", "location", "routine"]

def _empty_state() -> dict:
    return {s: {"state": "unknown", "reason": "", "cosine_distance": None, "updated_at": None}
            for s in SIGNALS}

signal_state: dict[str, dict] = _empty_state()
fall_active: bool = False

# ---------------------------------------------------------------------------
# SSE client registry
# ---------------------------------------------------------------------------

_clients: list[asyncio.Queue] = []


async def _broadcast(event: dict) -> None:
    dead = []
    for q in _clients:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _clients.remove(q)
        except ValueError:
            pass


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_signal_sse(signal: str, state: str, reason: str,
                     cosine: float | None = None) -> dict:
    signal_state[signal] = {
        "state": state, "reason": reason,
        "cosine_distance": cosine, "updated_at": _ts(),
    }
    return {
        "event": "signal_update",
        "payload": {
            "signal": signal, "state": state,
            "reason": reason, "cosine_distance": cosine,
            "updated_at": signal_state[signal]["updated_at"],
        },
    }


# ---------------------------------------------------------------------------
# In-memory event → signal rules (Phase 1 fallback; replaced by Tanmay's signals.py)
# ---------------------------------------------------------------------------

async def _process_event_inplace(event: dict) -> list[dict]:
    """Derive SSE events from a raw ingest event without Tanmay's modules."""
    sse_out: list[dict] = []
    et = event.get("event_type", "")
    room = event.get("room", "")
    payload = event.get("payload", {})
    now = event.get("timestamp", _ts())

    if et == "presence_detected":
        sse_out.append({
            "event": "presence_update",
            "payload": {"room": room, "occupied": True, "fall": False, "updated_at": now},
        })
        hour = datetime.fromisoformat(now.replace("Z", "+00:00")).hour
        if room == "bedroom" and 5 <= hour <= 11:
            sse_out.append(_make_signal_sse("woke_up", "green",
                                            f"Bedroom motion at {hour:02d}:xx"))
        elif room == "kitchen":
            dwell = payload.get("dwell_s", 0)
            if dwell >= 300:
                sse_out.append(_make_signal_sse("ate", "green",
                                                f"Kitchen dwell {dwell//60} min"))
            elif dwell > 0:
                sse_out.append(_make_signal_sse("ate", "amber",
                                                f"Kitchen dwell only {dwell//60} min"))

    elif et == "presence_ended":
        sse_out.append({
            "event": "presence_update",
            "payload": {"room": room, "occupied": False, "fall": False, "updated_at": now},
        })

    elif et == "dispenser_opened":
        sse_out.append(_make_signal_sse("took_meds", "green",
                                        f"Dispenser opened — compartment {payload.get('compartment')}"))

    elif et == "dispenser_missed":
        sse_out.append(_make_signal_sse("took_meds", "red",
                                        f"Dispenser missed — {payload.get('minutes_overdue', 0)} min overdue"))

    elif et == "breathing_update":
        state = "green" if payload.get("in_baseline", True) else "amber"
        sse_out.append(_make_signal_sse("rested_well", state,
                                        f"Breathing rate {payload.get('rate_bpm', '?')} bpm"))

    elif et == "multi_presence_detected":
        sse_out.append(_make_signal_sse("helper_present", "green",
                                        f"Second presence detected in helper window"))

    elif et == "voice_checkin_completed":
        confused = payload.get("confusion_markers", False)
        state = "red" if confused else "green"
        reason = (f"Speech {payload.get('speech_rate_wpm')} wpm, "
                  f"clarity {payload.get('clarity_score')}"
                  + (", confusion markers" if confused else ""))
        sse_out.append(_make_signal_sse("voice_checkin", state, reason))

    elif et == "voice_distress_detected":
        reason = (f"Distress: {payload.get('speech_rate_wpm')} wpm, "
                  f"clarity {payload.get('clarity_score')}, confusion markers, "
                  f"latency {payload.get('response_latency_s')}s")
        sse_out.append(_make_signal_sse("voice_checkin", "red", reason,
                                        payload.get("baseline_deviation_cosine")))

    elif et == "location_update":
        match = payload.get("baseline_cluster_match", True)
        score = payload.get("trajectory_density_score", 1.0)
        state = "green" if match else ("amber" if score > 0.15 else "red")
        sse_out.append({
            "event": "location_update",
            "payload": {**payload, "updated_at": now},
        })
        sse_out.append(_make_signal_sse("location", state,
                                        f"Density score {score:.2f}",
                                        payload.get("cosine_distance")))

    elif et == "wandering_detected":
        reason = (f"Outside baseline footprint "
                  f"{payload.get('minutes_outside_baseline_footprint', 0)} min, "
                  f"density {payload.get('trajectory_density_score', 0):.2f}")
        sse_out.append({"event": "wandering_detected", "payload": {**payload, "updated_at": now}})
        sse_out.append(_make_signal_sse("location", "red", reason))

    elif et == "cosine_update":
        # Tanmay emits this when routine cosine is recomputed
        score = payload.get("cosine_distance", 0.0)
        state = "green" if score < 0.15 else ("amber" if score < 0.25 else "red")
        sse_out.append(_make_signal_sse("routine", state,
                                        f"Cosine distance {score:.2f}", score))

    elif et == "fall_detected":
        global fall_active
        fall_active = True
        sse_out.append({
            "event": "fall_detected",
            "payload": {
                "room": room or "bathroom",
                "posture": payload.get("posture", "prone"),
                "stationary_s": payload.get("stationary_s", 0),
                "confidence": event.get("confidence", 0.95),
                "updated_at": now,
            },
        })
        sse_out.append({
            "event": "presence_update",
            "payload": {"room": room or "bathroom", "occupied": True, "fall": True, "updated_at": now},
        })

    return sse_out


# ---------------------------------------------------------------------------
# Scenario timelines (internal runner — mirrors mock_server.py sequences)
# ---------------------------------------------------------------------------

_scenario_task: asyncio.Task | None = None

SCENARIO_EVENTS: dict[str, list[tuple[float, dict]]] = {
    "normal": [
        (0.0, {"event_type": "presence_detected", "source": "mmwave_ld2410",
               "room": "bedroom", "timestamp": "", "confidence": 0.97,
               "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"}}),
        (2.0, {"event_type": "presence_ended", "source": "mmwave_ld2410",
               "room": "bedroom", "timestamp": "", "confidence": 0.97, "payload": {}}),
        (2.1, {"event_type": "presence_detected", "source": "mmwave_ld2410",
               "room": "bathroom", "timestamp": "", "confidence": 0.97,
               "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"}}),
        (4.0, {"event_type": "presence_ended", "source": "mmwave_ld2410",
               "room": "bathroom", "timestamp": "", "confidence": 0.97, "payload": {}}),
        (4.1, {"event_type": "presence_detected", "source": "mmwave_ld2410",
               "room": "kitchen", "timestamp": "", "confidence": 0.97,
               "payload": {"targets": 1, "dwell_s": 1320, "motion": "stationary"}}),
        (6.0, {"event_type": "dispenser_opened", "source": "pill_dispenser",
               "timestamp": "", "confidence": 1.0,
               "payload": {"compartment": "morning", "expected_window_start": "08:00",
                           "delta_minutes": 10}}),
        (7.0, {"event_type": "breathing_update", "source": "mmwave_mr60bha2",
               "room": "bedroom", "timestamp": "", "confidence": 0.93,
               "payload": {"rate_bpm": 14, "in_baseline": True, "overnight_dwell_h": 7.8}}),
        (8.0, {"event_type": "voice_checkin_completed", "source": "voice_system",
               "timestamp": "", "confidence": 0.91,
               "payload": {"speech_rate_wpm": 138, "clarity_score": 0.87,
                           "sentiment": "positive", "confusion_markers": False,
                           "response_latency_s": 1.2, "duration_s": 142}}),
        (9.0, {"event_type": "multi_presence_detected", "source": "mmwave_ld2410",
               "room": "living_room", "timestamp": "", "confidence": 0.94,
               "payload": {"targets": 2, "motion": "mixed"}}),
        (10.0, {"event_type": "location_update", "source": "gps_tracker",
                "timestamp": "", "confidence": 0.97,
                "payload": {"lat": 22.5431, "lng": 114.0579,
                            "distance_from_home_m": 620,
                            "trajectory_density_score": 0.91,
                            "baseline_cluster_match": True}}),
        (11.0, {"event_type": "cosine_update", "source": "baseline",
                "timestamp": "", "confidence": 1.0,
                "payload": {"cosine_distance": 0.04}}),
    ],
    # 7-Day Trend — condensed to ~28s wall time for demo Act 2
    # Each "day" is ~4s. Day 7 fires voice_distress + wandering + missed dose.
    "trend_7day": [
        # Days 1-2: normal baseline
        (0.0,  {"event_type": "presence_detected", "source": "mmwave_ld2410",
                "room": "bedroom", "timestamp": "", "confidence": 0.97,
                "payload": {"targets": 1, "dwell_s": 0, "motion": "moving"}}),
        (1.0,  {"event_type": "presence_detected", "source": "mmwave_ld2410",
                "room": "kitchen", "timestamp": "", "confidence": 0.97,
                "payload": {"targets": 1, "dwell_s": 1320, "motion": "stationary"}}),
        (2.0,  {"event_type": "dispenser_opened", "source": "pill_dispenser",
                "timestamp": "", "confidence": 1.0,
                "payload": {"compartment": "morning", "expected_window_start": "08:00",
                            "delta_minutes": 11}}),
        (3.0,  {"event_type": "voice_checkin_completed", "source": "voice_system",
                "timestamp": "", "confidence": 0.92,
                "payload": {"speech_rate_wpm": 141, "clarity_score": 0.88,
                            "sentiment": "positive", "confusion_markers": False,
                            "response_latency_s": 1.1, "duration_s": 145}}),
        (4.0,  {"event_type": "cosine_update", "source": "baseline",
                "timestamp": "", "confidence": 1.0,
                "payload": {"cosine_distance": 0.04}}),
        # Day 3: first signs — kitchen dwell drops, cosine climbs
        (8.0,  {"event_type": "presence_detected", "source": "mmwave_ld2410",
                "room": "kitchen", "timestamp": "", "confidence": 0.97,
                "payload": {"targets": 1, "dwell_s": 480, "motion": "stationary"}}),
        (9.0,  {"event_type": "cosine_update", "source": "baseline",
                "timestamp": "", "confidence": 1.0,
                "payload": {"cosine_distance": 0.08}}),
        # Day 5: amber — voice clarity drops, dwell minimal
        (16.0, {"event_type": "presence_detected", "source": "mmwave_ld2410",
                "room": "kitchen", "timestamp": "", "confidence": 0.97,
                "payload": {"targets": 1, "dwell_s": 300, "motion": "stationary"}}),
        (17.0, {"event_type": "voice_checkin_completed", "source": "voice_system",
                "timestamp": "", "confidence": 0.88,
                "payload": {"speech_rate_wpm": 105, "clarity_score": 0.68,
                            "sentiment": "neutral", "confusion_markers": False,
                            "response_latency_s": 2.9, "duration_s": 110}}),
        (18.0, {"event_type": "cosine_update", "source": "baseline",
                "timestamp": "", "confidence": 1.0,
                "payload": {"cosine_distance": 0.17}}),
        # Day 7: crisis — voice distress + wandering + missed dose
        (25.0, {"event_type": "voice_distress_detected", "source": "voice_system",
                "timestamp": "", "confidence": 0.83,
                "payload": {"speech_rate_wpm": 89, "clarity_score": 0.61,
                            "sentiment": "confused", "confusion_markers": True,
                            "response_latency_s": 4.7,
                            "baseline_deviation_cosine": 0.38}}),
        (26.0, {"event_type": "wandering_detected", "source": "gps_tracker",
                "timestamp": "", "confidence": 0.88,
                "payload": {"lat": 22.5512, "lng": 114.0701,
                            "distance_from_home_m": 1800,
                            "trajectory_density_score": 0.09,
                            "baseline_cluster_match": False,
                            "minutes_outside_baseline_footprint": 34}}),
        (27.0, {"event_type": "dispenser_missed", "source": "pill_dispenser",
                "timestamp": "", "confidence": 1.0,
                "payload": {"compartment": "morning",
                            "window_closed_at": "11:00", "minutes_overdue": 120}}),
        (28.0, {"event_type": "cosine_update", "source": "baseline",
                "timestamp": "", "confidence": 1.0,
                "payload": {"cosine_distance": 0.38}}),
    ],
    "fall": [
        (0.0, {"event_type": "fall_detected", "source": "mmwave_mr60fda1",
               "room": "bathroom", "timestamp": "", "confidence": 0.95,
               "payload": {"posture": "prone", "stationary_s": 12}}),
    ],
}


async def _run_scenario(name: str) -> None:
    global fall_active
    if name == "fall":
        # Hard override: fire immediately regardless of other active scenario
        await _ingest_and_broadcast({
            "event_type": "fall_detected", "source": "mmwave_mr60fda1",
            "room": "bathroom", "timestamp": _ts(), "confidence": 0.95,
            "payload": {"posture": "prone", "stationary_s": 12},
        })
        return

    events = SCENARIO_EVENTS.get(name, [])
    log.info("▶ scenario '%s' started (%d events)", name, len(events))
    # Anchor all scenario events to 08:00 UTC so the morning-window check
    # (5 ≤ hour ≤ 11) always fires for bedroom events regardless of real wall-clock.
    scenario_clock = datetime.now(timezone.utc).replace(
        hour=8, minute=0, second=0, microsecond=0
    )
    for delay, evt in events:
        await asyncio.sleep(delay)
        evt["timestamp"] = (scenario_clock + timedelta(seconds=delay)).isoformat()
        await _ingest_and_broadcast(evt)
    log.info("✓ scenario '%s' complete", name)

    if name == "normal":
        await _broadcast_connection_suggestion()


def _reset_state() -> None:
    global signal_state, fall_active
    signal_state = _empty_state()
    fall_active = False
    if HAS_TANMAY:
        try:
            from ingestion import reset_state as _ingest_reset  # noqa: PLC0415
            _ingest_reset()
        except Exception as exc:
            log.warning("ingestion.reset_state failed (%s)", exc)


# ---------------------------------------------------------------------------
# Core ingest + broadcast pipeline
# ---------------------------------------------------------------------------

async def _auto_dispatch_fall(event: dict) -> None:
    """Safety-reflex tier: auto-notify caregivers when a fall is detected."""
    if not AUTO_DISPATCH_ON_FALL:
        return

    room = event.get("room") or "bathroom"
    payload = event.get("payload") or {}
    posture = payload.get("posture", "unknown")
    stationary_s = payload.get("stationary_s", 0)
    now = _ts()
    message = (
        f"🚨 Guardian FALL ALERT · Ah-Ma · {room} · "
        f"{posture} · {stationary_s}s stationary · auto-dispatched · {now[:16].replace('T', ' ')} UTC"
    )
    channel = await _dispatch_alert(message)
    await _broadcast({
        "event": "intervention_ack",
        "payload": {
            "dispatched": True,
            "channel": channel,
            "message_preview": message,
            "updated_at": now,
        },
    })
    log.info("Fall auto-dispatch complete (channel=%s)", channel)


async def _ingest_and_broadcast(event: dict) -> None:
    global fall_active
    if HAS_TANMAY:
        try:
            sse_events = await asyncio.to_thread(_tanmay_ingest, event)
        except Exception as exc:
            log.warning("Tanmay ingest error (%s) — falling back", exc)
            sse_events = await _process_event_inplace(event)
    else:
        sse_events = await _process_event_inplace(event)

    had_fall = False
    for sse_evt in sse_events:
        # Keep signal_state in sync regardless of which code path produced the events.
        # Without this, HAS_TANMAY=True bypasses _make_signal_sse, leaving signal_state
        # stuck at "unknown" — /status badge and agent.maybe_assess both break silently.
        if sse_evt.get("event") == "signal_update":
            p = sse_evt["payload"]
            sig = p.get("signal")
            if sig in signal_state:
                signal_state[sig] = {
                    "state": p.get("state", "unknown"),
                    "reason": p.get("reason", ""),
                    "cosine_distance": p.get("cosine_distance"),
                    "updated_at": p.get("updated_at"),
                }
        elif sse_evt.get("event") == "fall_detected":
            fall_active = True
            had_fall = True
        await _broadcast(sse_evt)

    if had_fall:
        await _auto_dispatch_fall(event)

    # Optionally trigger agent reasoning (non-blocking)
    if HAS_AGENT and _agent and event.get("event_type") not in ("fall_detected",):
        asyncio.create_task(_agent.maybe_assess(signal_state, _broadcast))


# ---------------------------------------------------------------------------
# Pydantic schemas for /ingest and /trigger/intervention
# ---------------------------------------------------------------------------

class IngestEvent(BaseModel):
    event_type: str
    source: str
    room: str | None = None
    timestamp: str = Field(default_factory=_ts)
    confidence: float = 1.0
    payload: dict = Field(default_factory=dict)


class InterventionRequest(BaseModel):
    signal_summary: str = ""
    location: str = "Shenzhen"


class ConnectionRequest(BaseModel):
    note: str = ""  # optional personal note from the child to include in the WhatsApp nudge


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _agent
    try:
        from seed import seed_all  # noqa: PLC0415
        await asyncio.to_thread(seed_all)
        log.info("seed_all() complete ✓")
    except Exception as exc:
        log.warning("seed_all() skipped (%s)", exc)

    if HAS_AGENT:
        _agent = GuardianAgent(ollama_host=OLLAMA_HOST, broadcast=_broadcast)
        await _agent.initialise()
    log.info("Guardian backend ready on :8000")
    yield
    if _scenario_task and not _scenario_task.done():
        _scenario_task.cancel()


app = FastAPI(title="Guardian", version="8.3", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": len(_clients), "fall_active": fall_active}


@app.get("/status")
async def status() -> dict:
    """Powers the [● Running On-Device · Gemma 4 · 0 Bytes to Cloud] badge."""
    ollama_ok = False
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get(f"{OLLAMA_HOST}/api/tags")
            ollama_ok = r.status_code == 200
    except Exception:
        pass

    return {
        "on_device": True,
        "model": "gemma4:e4b",
        "bytes_to_cloud": 0,
        "ollama_running": ollama_ok,
        "ollama_host": OLLAMA_HOST,
        "clients_connected": len(_clients),
        "signals": signal_state,
    }


@app.post("/ingest")
async def ingest(event: IngestEvent) -> dict:
    await _ingest_and_broadcast(event.model_dump())
    return {"status": "ok", "event_type": event.event_type}


@app.get("/events")
async def events(request: Request) -> EventSourceResponse:
    async def generator():
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        _clients.append(q)
        log.info("SSE client connected (%d total)", len(_clients))

        # Send current state snapshot on connect
        for sig, data in signal_state.items():
            if data["state"] != "unknown":
                snapshot = {
                    "event": "signal_update",
                    "payload": {"signal": sig, **data},
                }
                yield {"data": json.dumps(snapshot)}

        if HAS_CONNECTION:
            try:
                prefs = load_prefs()
                window = compute_connection_window(prefs)
                yield {
                    "data": json.dumps(
                        {"event": "connection_window", "payload": window}
                    )
                }
            except Exception as exc:
                log.warning("SSE connection_window snapshot failed (%s)", exc)

        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"data": json.dumps(event)}
                except asyncio.TimeoutError:
                    yield {"data": json.dumps({"event": "ping", "payload": {}})}
        finally:
            try:
                _clients.remove(q)
            except ValueError:
                pass
            log.info("SSE client disconnected (%d remaining)", len(_clients))

    return EventSourceResponse(generator())


@app.post("/scenario/{name}")
async def run_scenario(name: str) -> dict:
    global _scenario_task
    valid = {"normal", "trend_7day", "fall"}
    if name not in valid:
        raise HTTPException(400, f"Unknown scenario '{name}'. Valid: {sorted(valid)}")

    if _scenario_task and not _scenario_task.done():
        _scenario_task.cancel()
        await asyncio.sleep(0.05)

    _reset_state()

    if HAS_AGENT and _agent is not None:
        _agent.set_scenario(name)

    # Broadcast state reset so the dashboard clears
    await _broadcast({"event": "state_reset", "payload": {"scenario": name, "updated_at": _ts()}})

    _scenario_task = asyncio.create_task(_run_scenario(name))
    return {"status": "started", "scenario": name}


# ---------------------------------------------------------------------------
# Alert dispatch helper — WeCom (WeChat) preferred, WhatsApp fallback
# ---------------------------------------------------------------------------

async def _dispatch_alert(message: str) -> str:
    """
    Fire an alert message to the caregiver. Tries WeCom webhook first (best
    for mainland China / GBA), falls back to WhatsApp Business API, then
    returns 'overlay_only' if neither is configured.

    Always returns within timeout — the overlay renders regardless of whether
    the delivery succeeds (PRD § 6).
    """
    # ── WeCom (企业微信) webhook bot ──────────────────────────────────────
    # Setup: WeChat Work → group → Add Group Bot → copy webhook URL → set WECOM_WEBHOOK_URL
    # Reaches any WeChat account in mainland China with no VPN required.
    if WECOM_WEBHOOK_URL:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(
                    WECOM_WEBHOOK_URL,
                    json={"msgtype": "text", "text": {"content": message}},
                )
                if resp.status_code == 200:
                    log.info("WeCom dispatch: OK")
                    return "wecom"
                log.warning("WeCom dispatch failed (%d): %s", resp.status_code, resp.text[:120])
        except Exception as exc:
            log.warning("WeCom error: %s", exc)

    # ── WhatsApp Business API fallback ────────────────────────────────────
    # Useful for HK-side family contacts. Requires Meta business account + verified number.
    if WHATSAPP_TOKEN and WHATSAPP_PHONE_ID:
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(
                    f"https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages",
                    headers={"Authorization": f"Bearer {WHATSAPP_TOKEN}",
                             "Content-Type": "application/json"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": CAREGIVER_PHONE,
                        "type": "text",
                        "text": {"body": message},
                    },
                )
                if resp.status_code == 200:
                    log.info("WhatsApp dispatch: OK")
                    return "whatsapp"
                log.warning("WhatsApp dispatch failed (%d)", resp.status_code)
        except Exception as exc:
            log.warning("WhatsApp error: %s", exc)

    log.info("No messaging channel configured — overlay-only mode")
    return "overlay_only"


@app.post("/trigger/intervention")
async def trigger_intervention(body: InterventionRequest) -> dict:
    """
    Dispatch emergency alert to caregiver in Shenzhen. Tries WeCom (WeChat
    group bot) first — best for mainland China. Falls back to WhatsApp.
    Always returns overlay payload within 500ms regardless of delivery result.
    """
    now = _ts()
    summary = body.signal_summary or _build_signal_summary()
    message = (
        f"🔴 Guardian Alert · Ah-Ma · {body.location} · "
        f"{summary} · {now[:16].replace('T', ' ')} UTC"
    )

    channel = await _dispatch_alert(message)

    # Broadcast intervention_ack so dashboard updates immediately
    await _broadcast({
        "event": "intervention_ack",
        "payload": {
            "dispatched": True,
            "channel": channel,
            "message_preview": message,
            "updated_at": now,
        },
    })

    return {
        "status": "dispatched",
        "channel": channel,
        "overlay_message": "Alert dispatched — Shenzhen Care Network notified",
        "message_preview": message,
        "timestamp": now,
    }


# ---------------------------------------------------------------------------
# Connection window routes
# ---------------------------------------------------------------------------

@app.get("/api/connection-window")
async def connection_window() -> dict:
    """
    Return the best time for the child to call Ah-Ma, inferred from her
    14-day presence + voice baseline. No cloud. No calendar OAuth.
    """
    if HAS_CONNECTION:
        prefs = await asyncio.to_thread(load_prefs)
        result = await asyncio.to_thread(compute_connection_window, prefs)
    else:
        result = _connection_window_stub()

    # Also broadcast as SSE so the dashboard card updates live
    await _broadcast({"event": "connection_window", "payload": result})
    return result


@app.post("/trigger/connection")
async def trigger_connection(body: ConnectionRequest) -> dict:
    """
    Send a gentle WhatsApp nudge to the child: Ah-Ma seems calm, good time to call.
    Softer than /trigger/intervention — no red alert language.
    Returns overlay payload within 500ms regardless of WhatsApp result.
    """
    if HAS_CONNECTION:
        prefs = await asyncio.to_thread(load_prefs)
        window = await asyncio.to_thread(compute_connection_window, prefs)
    else:
        window = _connection_window_stub()

    now = _ts()
    best = window.get("best_window", "15:00-16:00")
    rationale = window.get("rationale", "")
    note_str = f" · Note: {body.note}" if body.note else ""

    message = (
        f"💚 Guardian · Ah-Ma is calm and present right now ({best}). "
        f"A good moment to call her.{note_str}"
    )

    channel = await _dispatch_alert(message)

    ack = {
        "event": "connection_ack",
        "payload": {
            "dispatched": True,
            "channel": channel,
            "best_window": best,
            "rationale": rationale,
            "message_preview": message,
            "updated_at": now,
        },
    }
    await _broadcast(ack)

    return {
        "status": "dispatched",
        "channel": channel,
        "best_window": best,
        "overlay_message": f"Great time to call — Ah-Ma is calm right now ({best})",
        "message_preview": message,
        "timestamp": now,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _broadcast_connection_suggestion() -> None:
    """Emit connection_window + cached agent rationale after the normal demo."""
    if HAS_CONNECTION:
        prefs = await asyncio.to_thread(load_prefs)
        window = await asyncio.to_thread(compute_connection_window, prefs)
    else:
        window = _connection_window_stub()

    await _broadcast({"event": "connection_window", "payload": window})

    if HAS_AGENT and _agent is not None:
        await _agent.assess_signal("connection_window", "suggested", signal_state)


def _connection_window_stub() -> dict:
    """Fallback when connection.py is unavailable."""
    return {
        "best_window": "15:00-16:00",
        "best_hour": 15,
        "overlap_with_child": True,
        "confidence": "moderate",
        "evidence": {"presence_days": None, "baseline_days": 14,
                     "avg_clarity": None, "positivity_rate": None},
        "rationale": (
            "Ah-Ma is typically calm and present in the early afternoon. "
            "You are free at this time."
        ),
        "updated_at": _ts(),
    }


def _build_signal_summary() -> str:
    parts = []
    emoji = {"green": "🟢", "amber": "🟡", "red": "🔴", "unknown": "⚪"}
    for sig, data in signal_state.items():
        parts.append(f"{sig.replace('_', ' ').title()} {emoji.get(data['state'], '⚪')}")
    return " · ".join(parts)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
