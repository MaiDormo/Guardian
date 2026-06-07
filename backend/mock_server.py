"""
mock_server.py — Standalone SSE server for Mar's frontend-first development.

No dependencies on other backend modules. Run independently:
    python mock_server.py

Serves:
    GET  /events          — SSE stream (same contract as main.py)
    POST /scenario/{name} — Switch active scenario (normal | trend_7day | fall)
    GET  /health          — Health check

Mar's frontend points NEXT_PUBLIC_API_URL=http://localhost:8001 during dev.
All SSE events match the schema defined in PRD § 5.6 exactly.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [mock] %(message)s")
log = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# Scripted scenario sequences
# (delay_s, sse_event_dict)  — delay is relative to previous event
# ---------------------------------------------------------------------------

def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sig(signal: str, state: str, reason: str, cosine: float | None = None) -> dict:
    return {
        "event": "signal_update",
        "payload": {
            "signal": signal,
            "state": state,
            "reason": reason,
            "cosine_distance": cosine,
            "updated_at": _ts(),
        },
    }


def _presence(room: str, occupied: bool, fall: bool = False) -> dict:
    return {
        "event": "presence_update",
        "payload": {"room": room, "occupied": occupied, "fall": fall, "updated_at": _ts()},
    }


def _reasoning(signal: str, cosine: float, features: list[str], rationale: str) -> dict:
    return {
        "event": "reasoning_update",
        "payload": {
            "signal": signal,
            "cosine_distance": cosine,
            "baseline_window_days": 14,
            "features_considered": features,
            "rationale": rationale,
            "updated_at": _ts(),
        },
    }


# Normal Morning — Scenario A
# Blue radar blip: bedroom → bathroom → kitchen, all 8 cards go green
SCENARIO_NORMAL: list[tuple[float, dict]] = [
    (0.0,  _presence("bedroom", True)),
    (1.5,  _sig("woke_up", "green", "Bedroom motion at 07:23", 0.04)),
    (3.0,  _presence("bedroom", False)),
    (3.2,  _presence("bathroom", True)),
    (5.0,  _presence("bathroom", False)),
    (5.2,  _presence("kitchen", True)),
    (7.0,  _sig("ate", "green", "Kitchen dwell 22 min — within meal window", 0.04)),
    (8.5,  _sig("took_meds", "green", "Dispenser opened 08:10, +10 min delta", 0.04)),
    (10.0, _sig("rested_well", "green", "In-bed 23:10–07:15, breathing normal band", 0.04)),
    (11.5, _sig("helper_present", "green", "Second presence 10:00–12:30", 0.04)),
    (13.0, _sig("voice_checkin", "green", "Speech 138 wpm, clarity 0.87, no confusion", 0.04)),
    (14.5, _sig("location", "green", "Trajectory within baseline spatial footprint", 0.04)),
    (16.0, _sig("routine", "green", "All signals nominal", 0.04)),
    (17.0, _reasoning(
        "routine", 0.04,
        ["presence_patterns", "meal_timing", "voice_baseline", "gps_trajectory"],
        "All signals nominal. Morning routine follows 30-day baseline precisely. "
        "Bedroom exit 07:23, kitchen presence 07:52, dispenser opened 08:10. "
        "Baseline deviation: 0.04 — well within normal variance.",
    )),
    (19.0, _presence("kitchen", False)),
]

# 7-Day Trend — Scenario B
# Day 1-2: all green → Day 3-4: amber drift → Day 7: multi-modal red + intervention
SCENARIO_TREND: list[tuple[float, dict]] = [
    # Day 1 — normal
    (0.0,  _sig("woke_up", "green", "Day 1 — baseline normal", 0.04)),
    (0.3,  _sig("ate", "green", "Day 1 — kitchen dwell 21 min", 0.04)),
    (0.6,  _sig("took_meds", "green", "Day 1 — dispenser on time", 0.04)),
    (0.9,  _sig("rested_well", "green", "Day 1 — breathing normal", 0.04)),
    (1.2,  _sig("voice_checkin", "green", "Day 1 — speech 141 wpm", 0.04)),
    (1.5,  _sig("location", "green", "Day 1 — familiar footprint", 0.04)),
    (1.8,  _sig("routine", "green", "Day 1 — cosine 0.04", 0.04)),
    # Day 2 — normal
    (4.0,  _sig("woke_up", "green", "Day 2 — baseline normal", 0.05)),
    (4.3,  _sig("routine", "green", "Day 2 — cosine 0.05", 0.05)),
    # Day 3 — first signs
    (8.0,  _sig("ate", "amber", "Day 3 — kitchen dwell 8 min, below baseline", 0.08)),
    (8.5,  _sig("routine", "amber", "Day 3 — cosine 0.08, mild drift", 0.08)),
    # Day 4
    (12.0, _sig("woke_up", "amber", "Day 4 — no bedroom motion until 10:42", 0.12)),
    (12.5, _sig("voice_checkin", "amber", "Day 4 — clarity 0.74, slight drop", 0.12)),
    (13.0, _sig("routine", "amber", "Day 4 — cosine 0.12", 0.12)),
    # Day 5
    (17.0, _sig("ate", "amber", "Day 5 — kitchen dwell 5 min, significant drop", 0.17)),
    (17.5, _reasoning(
        "ate", 0.17,
        ["kitchen_dwell_s", "meal_window_compliance"],
        "Kitchen dwell 5 min vs baseline 22 min (-77%). Pattern consistent with "
        "reduced appetite or fatigue. Monitoring escalation.",
    )),
    (18.0, _sig("routine", "amber", "Day 5 — cosine 0.17, escalating", 0.17)),
    # Day 7 — multi-modal crisis
    (26.0, {
        "event": "presence_update",
        "payload": {"room": "kitchen", "occupied": False, "fall": False, "updated_at": _ts()},
    }),
    (27.0, _sig("voice_checkin", "red", "Day 7 — speech 89 wpm, confusion markers, latency 4.7s", 0.38)),
    (27.5, _reasoning(
        "voice_checkin", 0.38,
        ["speech_rate_wpm", "clarity_score", "confusion_markers", "response_latency_s"],
        "Day 7 voice check-in: speech rate 89 WPM (baseline 138, -35.5%). "
        "Clarity score 0.61 (baseline 0.87). Active confusion markers detected. "
        "Response latency 4.7s (baseline 1.2s). Multiple features simultaneously "
        "deviated — consistent with acute cognitive episode.",
    )),
    (28.5, {
        "event": "wandering_detected",
        "payload": {
            "trajectory_density_score": 0.09,
            "baseline_cluster_match": False,
            "minutes_outside_baseline_footprint": 34,
            "updated_at": _ts(),
        },
    }),
    (29.0, _sig("location", "red", "Trajectory outside all baseline clusters, 34 min", 0.38)),
    (29.5, _reasoning(
        "location", 0.38,
        ["trajectory_density_score", "baseline_cluster_match", "minutes_outside_baseline_footprint"],
        "GPS trajectory outside spatial footprint. Density score 0.09 — below 0.15 "
        "threshold. 34 minutes outside all known baseline clusters. Cross-referenced "
        "with voice_distress: speech rate -35%, active confusion markers. "
        "Multi-modal convergence: Ah-Ma is lost and confused.",
    )),
    (30.5, _sig("routine", "red", "Cosine 0.38 — multi-modal drift threshold exceeded", 0.38)),
    (31.0, _reasoning(
        "routine", 0.38,
        ["all_signals_composite"],
        "Composite routine embedding divergence: 0.04 → 0.17 → 0.38 over 7 days. "
        "Voice, location, and meal patterns all drifting simultaneously. "
        "Cosine distance exceeds 0.25 threshold. Multi-modal drift pattern "
        "consistent with early acute episode. Intervention recommended.",
    )),
]

# Fall Override — Scenario C
# Immediate: full-width banner, bathroom pulses violent red
SCENARIO_FALL: list[tuple[float, dict]] = [
    (0.0, {
        "event": "fall_detected",
        "payload": {
            "room": "bathroom",
            "posture": "prone",
            "stationary_s": 12,
            "confidence": 0.95,
            "updated_at": _ts(),
        },
    }),
    (0.1, _presence("bathroom", True, fall=True)),
    (0.5, _reasoning(
        "fall_detected", None,
        ["posture", "stationary_s", "mmwave_confidence"],
        "Priority interrupt — mmWave MR60FDA1, posture: prone, stationary 12s. "
        "Confidence: 0.95. Bypassed agent loop. Immediate intervention required.",
    )),
]

SCENARIOS: dict[str, list[tuple[float, dict]]] = {
    "normal": SCENARIO_NORMAL,
    "trend_7day": SCENARIO_TREND,
    "fall": SCENARIO_FALL,
}

# ---------------------------------------------------------------------------
# Scenario runner
# ---------------------------------------------------------------------------

_active_task: asyncio.Task | None = None


async def _run_scenario(name: str) -> None:
    sequence = SCENARIOS[name]
    log.info("▶ scenario %s started (%d events)", name, len(sequence))
    prev_delay = 0.0
    for delay, event in sequence:
        await asyncio.sleep(max(0.0, delay - prev_delay))
        prev_delay = delay
        # Refresh timestamps so they look live
        if "payload" in event and "updated_at" in event["payload"]:
            event["payload"]["updated_at"] = _ts()
        await _broadcast(event)
        log.debug("  → %s", event["event"])
    log.info("✓ scenario %s complete", name)


def _start_scenario(name: str) -> None:
    global _active_task
    if _active_task and not _active_task.done():
        _active_task.cancel()
    _active_task = asyncio.create_task(_run_scenario(name))


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("mock_server ready on :8001 — Mar, connect your frontend here")
    yield
    if _active_task and not _active_task.done():
        _active_task.cancel()


app = FastAPI(title="Guardian Mock SSE Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "server": "mock", "clients": len(_clients)}


@app.get("/events")
async def events(request: Request) -> EventSourceResponse:
    async def generator():
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        _clients.append(q)
        log.info("SSE client connected (%d total)", len(_clients))
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield {"data": json.dumps(event)}
                except asyncio.TimeoutError:
                    # Keepalive ping
                    yield {"data": json.dumps({"event": "ping", "payload": {}})}
        finally:
            try:
                _clients.remove(q)
            except ValueError:
                pass
            log.info("SSE client disconnected (%d remaining)", len(_clients))

    return EventSourceResponse(generator())


@app.post("/scenario/{name}")
async def set_scenario(name: str) -> JSONResponse:
    if name not in SCENARIOS:
        return JSONResponse(
            {"error": f"Unknown scenario '{name}'. Valid: {list(SCENARIOS)}"}, status_code=400
        )
    _start_scenario(name)
    return JSONResponse({"status": "started", "scenario": name, "events": len(SCENARIOS[name])})


if __name__ == "__main__":
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8001, reload=False, log_level="info")
