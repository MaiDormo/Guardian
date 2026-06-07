# Guardian Hardware — DESIGNED, NOT DEPLOYED

> **Status:** Reference design only. No ESP32 firmware is flashed during the hackathon demo.
> `data/sim/radar_simulator.py` emits the same event schema and posts to `POST /ingest`.

This directory documents the production sensing path: sensor selection, wiring, ESP32-S3
firmware sketch, and MQTT topic map (design-time). Replacing the simulator with real
hardware does not change anything downstream of `POST /ingest`.

---

## 1. Sensor inventory

| Sensor | Role | Guardian `source` | UART |
|--------|------|-------------------|------|
| Seeed MR60FDA1 | Fall detection (60 GHz) | `mmwave_mr60fda1` | 1 |
| Seeed MR60BHA2 | Presence + breathing | `mmwave_mr60bha2` | 2 |
| Hi-Link LD2410 | Room presence / dwell | `mmwave_ld2410` | 3 |
| ESP32-S3-DevKitC-1 | Edge aggregator | — | — |

Voice check-ins and GPS are out-of-band (phone / tracker) and are not wired on the ESP32
breadboard in v1.

---

## 2. Wiring (reference)

```
ESP32-S3 DevKitC-1
  UART1 (GPIO17 TX / GPIO18 RX)  →  MR60FDA1 (fall)
  UART2 (GPIO8  TX / GPIO9  RX)  →  MR60BHA2 (breathing)
  UART0 (GPIO43 TX / GPIO44 RX)  →  LD2410 (presence)  [USB-serial debug on separate port]
  3.3V + GND                     →  all radar modules (shared ground plane)
  GPIO4                          →  status LED (optional)
```

Power: 5 V USB-C to DevKit; radars draw from 3.3 V rail (verify per-module peak current
before permanent install). Ceiling-mount radars with downward tilt per manufacturer guides.

---

## 3. Event mapping (PRD §5.3 / §5.5)

Firmware `buildEvent()` mirrors `data/sim/radar_simulator.py`. Payload keys are verbatim.

### Presence (`mmwave_ld2410`)

```json
{
  "event_type": "presence_detected",
  "source": "mmwave_ld2410",
  "room": "kitchen",
  "timestamp": "ISO8601",
  "confidence": 0.97,
  "payload": { "targets": 1, "dwell_s": 0, "motion": "moving" }
}
```

`presence_ended` uses the same `source` / `room` with an empty `{}` payload.

### Fall (`mmwave_mr60fda1`)

```json
{
  "event_type": "fall_detected",
  "source": "mmwave_mr60fda1",
  "room": "bathroom",
  "timestamp": "ISO8601",
  "confidence": 0.95,
  "payload": { "posture": "prone", "stationary_s": 12 }
}
```

### Breathing / rested well (`mmwave_mr60bha2`)

```json
{
  "event_type": "breathing_update",
  "source": "mmwave_mr60bha2",
  "room": "bedroom",
  "timestamp": "ISO8601",
  "confidence": 0.93,
  "payload": {
    "rate_bpm": 14,
    "in_baseline": true,
    "overnight_dwell_h": 7.8
  }
}
```

### Multi-presence / helper (`mmwave_ld2410`)

```json
{
  "event_type": "multi_presence_detected",
  "source": "mmwave_ld2410",
  "room": "living_room",
  "timestamp": "ISO8601",
  "confidence": 0.97,
  "payload": { "targets": 2, "motion": "mixed" }
}
```

### Voice check-in (§5.3 — phone-side, not ESP32)

```json
{
  "event_type": "voice_checkin_completed",
  "source": "voice_system",
  "timestamp": "ISO8601",
  "confidence": 0.91,
  "payload": {
    "speech_rate_wpm": 138,
    "clarity_score": 0.87,
    "sentiment": "positive",
    "confusion_markers": false,
    "response_latency_s": 1.2,
    "duration_s": 142
  }
}
```

Distress variant: `event_type: "voice_distress_detected"` with optional pre-injected
`baseline_deviation_cosine` (simulator Day-7 uses `0.38`).

---

## 4. MQTT topic map (design-time only)

Not enabled in the hackathon `.env`. Documented for post-demo bring-up.

| Topic | Direction | Payload |
|-------|-----------|---------|
| `guardian/{home_id}/events/presence` | ESP32 → broker | Guardian wire event JSON |
| `guardian/{home_id}/events/fall` | ESP32 → broker | Guardian wire event JSON |
| `guardian/{home_id}/events/breathing` | ESP32 → broker | Guardian wire event JSON |
| `guardian/{home_id}/status/heartbeat` | ESP32 → broker | `{"uptime_s": N, "rssi": -42}` |

A small bridge service (not in repo) would subscribe and `POST` each message to
`BACKEND_URL/ingest`. The demo skips MQTT entirely and uses `radar_simulator.py`.

---

## 5. Firmware sketch

See [`esp32_firmware.ino`](esp32_firmware.ino) — placeholder `#define`s, pin map,
`buildEvent()` stubs, and datasheet TODOs for UART frame parsing.

---

## 6. Bring-up checklist (post-hackathon)

1. Flash `esp32_firmware.ino`; confirm UART frames parse per Seeed / Hi-Link datasheets.
2. Validate each event type against `pytest backend/tests/test_ingest.py`.
3. Run `pytest backend/tests/replay.py` — accuracy gate must stay ≥26/32.
4. Optionally add MQTT bridge; **do not** add `MQTT_BROKER` to `.env.example` until deployed.
