"""
radar_simulator.py — Guardian Fuzzy-Routine Scenario Engine.

Generates synthetic sensor events with human-realistic timestamp jitter
and POSTs them to POST /ingest on a scripted timeline.

Usage:
    # Play Normal Morning scenario once (live demo pacing)
    python radar_simulator.py --scenario normal

    # Play 7-Day Trend at 30x speed
    python radar_simulator.py --scenario trend_7day

    # Fire fall override immediately
    python radar_simulator.py --scenario fall

    # Seed 30 days of baseline data (pre-demo setup)
    python radar_simulator.py --scenario seed --days 30

Environment:
    BACKEND_URL  — defaults to http://localhost:8000
"""

import argparse
import asyncio
import logging
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("simulator")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [sim] %(message)s")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# ---------------------------------------------------------------------------
# Fuzzy-Routine helpers
# ---------------------------------------------------------------------------

def jitter(minutes: float, sigma: float = 15.0) -> float:
    """Return minutes ± Gaussian jitter, clamped so it stays positive."""
    return max(0.0, minutes + random.gauss(0, sigma))


def ts_offset(base: datetime, offset_minutes: float) -> str:
    return (base + timedelta(minutes=offset_minutes)).isoformat()


def build_event(event_type: str, source: str, timestamp: str,
                confidence: float = 0.97,
                room: str | None = None,
                payload: dict | None = None) -> dict:
    ev: dict[str, Any] = {
        "event_type": event_type,
        "source": source,
        "timestamp": timestamp,
        "confidence": confidence,
        "payload": payload or {},
    }
    if room:
        ev["room"] = room
    return ev


async def post(client: httpx.AsyncClient, event: dict) -> None:
    try:
        r = await client.post(f"{BACKEND_URL}/ingest", json=event, timeout=5.0)
        r.raise_for_status()
        log.info("  ✓ %s  room=%s", event["event_type"], event.get("room", "-"))
    except Exception as exc:
        log.warning("  ✗ POST failed: %s", exc)


# ---------------------------------------------------------------------------
# One day of Normal Morning events (with jitter)
# ---------------------------------------------------------------------------

def normal_day_events(day_base: datetime, *, speed: float = 1.0) -> list[tuple[float, dict]]:
    """
    Returns list of (delay_from_start_seconds, event) for one normal day.
    delay_from_start_seconds is real-wall delay at 1x speed.
    Pass speed > 1 to compress (e.g., speed=30 for 30x).

    Typical day timeline (minutes from midnight):
      ~07:20  bedroom presence detected (woke up)
      ~07:35  bathroom presence
      ~07:55  kitchen presence + dwell (ate)
      ~08:10  dispenser opened (took meds)
      ~10:00  voice check-in
      ~10:30  helper presence
      ~12:30  kitchen presence (lunch)
      ~14:00  bedroom/living room (rest)
      ~18:00  kitchen presence (dinner)
      ~23:00  bedroom (sleep)
      overnight breathing update
    """
    # Wall-clock delay = (real_minutes_from_midnight) * 60 / speed
    def delay(minute: float, sigma: float = 10.0) -> float:
        return jitter(minute, sigma) * 60.0 / speed

    events: list[tuple[float, dict]] = []

    def add(d: float, **kwargs) -> None:
        events.append((d, build_event(timestamp=ts_offset(day_base, d * speed / 60.0), **kwargs)))

    wake_min = jitter(7 * 60 + 20, 12)
    add(wake_min * 60 / speed,
        event_type="presence_detected", source="mmwave_ld2410", room="bedroom",
        payload={"targets": 1, "dwell_s": 0, "motion": "moving"})

    add((wake_min + jitter(15, 5)) * 60 / speed,
        event_type="presence_ended", source="mmwave_ld2410", room="bedroom", payload={})

    bath_min = wake_min + jitter(12, 5)
    add(bath_min * 60 / speed,
        event_type="presence_detected", source="mmwave_ld2410", room="bathroom",
        payload={"targets": 1, "dwell_s": 0, "motion": "moving"})

    add((bath_min + jitter(20, 5)) * 60 / speed,
        event_type="presence_ended", source="mmwave_ld2410", room="bathroom", payload={})

    kitchen_min = bath_min + jitter(18, 8)
    kitchen_dwell = int(jitter(22 * 60, 5 * 60))  # ~22 min dwell, ±5 min
    add(kitchen_min * 60 / speed,
        event_type="presence_detected", source="mmwave_ld2410", room="kitchen",
        payload={"targets": 1, "dwell_s": kitchen_dwell, "motion": "stationary"})

    add((kitchen_min + jitter(25, 5)) * 60 / speed,
        event_type="presence_ended", source="mmwave_ld2410", room="kitchen", payload={})

    # Pill dispenser
    add((kitchen_min + jitter(18, 8)) * 60 / speed,
        event_type="dispenser_opened", source="pill_dispenser",
        confidence=1.0,
        payload={"compartment": "morning",
                 "expected_window_start": "08:00",
                 "delta_minutes": int(jitter(10, 8))})

    # Voice check-in (~10:00)
    add(jitter(10 * 60, 20) * 60 / speed,
        event_type="voice_checkin_completed", source="voice_system",
        confidence=round(random.uniform(0.88, 0.96), 2),
        payload={
            "speech_rate_wpm": int(jitter(138, 8)),
            "clarity_score": round(random.uniform(0.84, 0.92), 2),
            "sentiment": "positive",
            "confusion_markers": False,
            "response_latency_s": round(jitter(1.2, 0.3), 1),
            "duration_s": int(jitter(140, 20)),
        })

    # Helper (~10:30)
    add(jitter(10 * 60 + 30, 30) * 60 / speed,
        event_type="multi_presence_detected", source="mmwave_ld2410",
        room="living_room",
        payload={"targets": 2, "motion": "mixed"})

    # Lunch (~12:30)
    add(jitter(12 * 60 + 30, 20) * 60 / speed,
        event_type="presence_detected", source="mmwave_ld2410", room="kitchen",
        payload={"targets": 1, "dwell_s": int(jitter(15 * 60, 3 * 60)), "motion": "stationary"})

    # GPS — normal footprint
    add(jitter(11 * 60, 30) * 60 / speed,
        event_type="location_update", source="gps_tracker",
        confidence=0.97,
        payload={
            "lat": round(22.5431 + random.gauss(0, 0.001), 4),
            "lng": round(114.0579 + random.gauss(0, 0.001), 4),
            "distance_from_home_m": int(jitter(600, 80)),
            "trajectory_density_score": round(random.uniform(0.85, 0.95), 2),
            "baseline_cluster_match": True,
        })

    # Breathing / rested well (overnight — reported as start of day)
    add(0.0,
        event_type="breathing_update", source="mmwave_mr60bha2",
        room="bedroom",
        confidence=0.93,
        payload={
            "rate_bpm": int(jitter(14, 2)),
            "in_baseline": True,
            "overnight_dwell_h": round(jitter(7.8, 0.5), 1),
        })

    # Cosine routine update (end of morning)
    add(jitter(13 * 60, 20) * 60 / speed,
        event_type="cosine_update", source="baseline",
        confidence=1.0,
        payload={"cosine_distance": round(random.uniform(0.02, 0.07), 3)})

    events.sort(key=lambda x: x[0])
    return events


# ---------------------------------------------------------------------------
# 7-Day Trend events (progressive drift)
# ---------------------------------------------------------------------------

def trend_7day_events(base: datetime, *, speed: float = 30.0) -> list[tuple[float, dict]]:
    """
    7-day drift scenario. Day 7 triggers voice_distress + wandering_detected.
    speed=30 compresses 7 days to ~7*24*60/30 ≈ 336 minutes → ~5.6 hours.
    For the demo (60s budget for Act 2), use speed=10080 to compress to ~1 min.
    """
    events: list[tuple[float, dict]] = []
    day_seconds = 24 * 3600 / speed

    for day in range(1, 8):
        day_base = base + timedelta(seconds=day_seconds * (day - 1))
        degradation = (day - 1) / 6.0  # 0.0 on day 1, 1.0 on day 7

        def add(minute_in_day: float, **kwargs) -> None:
            wall_s = (day - 1) * day_seconds + minute_in_day * 60 / speed
            events.append((wall_s,
                           build_event(timestamp=(day_base + timedelta(minutes=minute_in_day)).isoformat(),
                                       **kwargs)))

        # Bedroom — wake time drifts later
        wake_min = 7 * 60 + 20 + degradation * 180  # day 7: up to 10:20
        add(wake_min,
            event_type="presence_detected", source="mmwave_ld2410", room="bedroom",
            payload={"targets": 1, "dwell_s": 0, "motion": "moving"})

        # Kitchen dwell drops off
        kitchen_dwell = max(120, int(1320 * (1 - degradation * 0.8)))  # 22min → ~2min
        add(wake_min + 30,
            event_type="presence_detected", source="mmwave_ld2410", room="kitchen",
            payload={"targets": 1, "dwell_s": kitchen_dwell, "motion": "stationary"})

        # Voice check-in — progressively worse
        speech_rate = int(138 - degradation * 49)  # 138 → 89
        clarity = round(0.87 - degradation * 0.26, 2)  # 0.87 → 0.61
        confused = day == 7
        latency = round(1.2 + degradation * 3.5, 1)  # 1.2s → 4.7s

        if day == 7:
            add(10 * 60,
                event_type="voice_distress_detected", source="voice_system",
                confidence=0.83,
                payload={
                    "speech_rate_wpm": speech_rate,
                    "clarity_score": clarity,
                    "sentiment": "confused",
                    "confusion_markers": True,
                    "response_latency_s": latency,
                    "baseline_deviation_cosine": 0.38,
                })
        else:
            add(10 * 60,
                event_type="voice_checkin_completed", source="voice_system",
                confidence=round(0.91 - degradation * 0.05, 2),
                payload={
                    "speech_rate_wpm": speech_rate,
                    "clarity_score": clarity,
                    "sentiment": "neutral" if day > 3 else "positive",
                    "confusion_markers": confused,
                    "response_latency_s": latency,
                    "duration_s": int(140 - degradation * 30),
                })

        # GPS — day 7: wandering
        if day == 7:
            add(10 * 60 + 15,
                event_type="wandering_detected", source="gps_tracker",
                confidence=0.88,
                payload={
                    "lat": 22.5512,
                    "lng": 114.0701,
                    "distance_from_home_m": 1800,
                    "trajectory_density_score": 0.09,
                    "baseline_cluster_match": False,
                    "minutes_outside_baseline_footprint": 34,
                })
        else:
            density = round(0.91 - degradation * 0.3, 2)
            add(11 * 60,
                event_type="location_update", source="gps_tracker",
                confidence=0.97,
                payload={
                    "lat": round(22.5431 + random.gauss(0, 0.002 * day), 4),
                    "lng": round(114.0579 + random.gauss(0, 0.002 * day), 4),
                    "distance_from_home_m": int(600 + degradation * 400),
                    "trajectory_density_score": density,
                    "baseline_cluster_match": density > 0.5,
                })

        # Pill dispenser — miss on day 7
        if day == 7:
            add(13 * 60,
                event_type="dispenser_missed", source="pill_dispenser",
                confidence=1.0,
                payload={"compartment": "morning", "window_closed_at": "11:00",
                         "minutes_overdue": 120})
        else:
            delta = int(jitter(10, 15 * degradation))
            add(8 * 60 + delta,
                event_type="dispenser_opened", source="pill_dispenser",
                confidence=1.0,
                payload={"compartment": "morning",
                         "expected_window_start": "08:00",
                         "delta_minutes": delta})

        # Cosine update — climbing
        cosine = round(0.04 + degradation * 0.34, 3)
        add(14 * 60,
            event_type="cosine_update", source="baseline",
            confidence=1.0,
            payload={"cosine_distance": cosine})

    events.sort(key=lambda x: x[0])
    return events


# ---------------------------------------------------------------------------
# Fall Override
# ---------------------------------------------------------------------------

def fall_events(base: datetime) -> list[tuple[float, dict]]:
    return [(
        0.0,
        build_event("fall_detected", "mmwave_mr60fda1",
                    timestamp=base.isoformat(),
                    confidence=0.95,
                    room="bathroom",
                    payload={"posture": "prone", "stationary_s": 12})
    )]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

async def play(scenario: str, speed: float, days: int = 1) -> None:
    base = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    if scenario == "normal":
        event_list = normal_day_events(base, speed=speed)
    elif scenario == "seed":
        event_list = []
        for d in range(days):
            day_base = base - timedelta(days=days - d)
            event_list.extend(normal_day_events(day_base, speed=speed))
        event_list.sort(key=lambda x: x[0])
    elif scenario == "trend_7day":
        event_list = trend_7day_events(base - timedelta(days=7), speed=speed)
    elif scenario == "fall":
        event_list = fall_events(datetime.now(timezone.utc))
    else:
        log.error("Unknown scenario: %s", scenario)
        sys.exit(1)

    log.info("▶ scenario=%s  events=%d  speed=%.0fx  backend=%s",
             scenario, len(event_list), speed, BACKEND_URL)

    async with httpx.AsyncClient() as client:
        prev_delay = 0.0
        for delay, event in event_list:
            sleep_s = delay - prev_delay
            if sleep_s > 0:
                await asyncio.sleep(sleep_s)
            prev_delay = delay
            await post(client, event)

    log.info("✓ scenario '%s' complete", scenario)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Guardian Radar Simulator")
    parser.add_argument("--scenario",
                        choices=["normal", "seed", "trend_7day", "fall"],
                        default="normal")
    parser.add_argument("--speed", type=float, default=1.0,
                        help="Playback speed multiplier (1=real-time, 30=30x)")
    parser.add_argument("--days", type=int, default=30,
                        help="Number of days for --scenario seed")
    parser.add_argument("--backend", default=None,
                        help="Override BACKEND_URL")
    args = parser.parse_args()

    if args.backend:
        BACKEND_URL = args.backend

    asyncio.run(play(args.scenario, args.speed, args.days))
