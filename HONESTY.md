# HONESTY.md

Guardian is a privacy-first eldercare system: millimetre-wave radar → on-device AI → eight plain-language daily wellbeing signals + immediate fall alerts. No cameras, no cloud.

This document states plainly what is **real** and what is **mocked**, per the hackathon's honesty requirement. We draw exactly **one mocked seam** — the sensor input — and everything downstream genuinely runs.

---

## ✅ Real (genuinely working, no fakery)

- **On-device LLM.** Gemma 4 (E4B; E2B fallback) runs locally via Ollama. All inference is on the demo machine — **zero network egress**. You can verify this by disconnecting the network mid-demo: Guardian keeps reasoning. The "On-device · 0 bytes to cloud" badge is literally true.
- **Local datastore + vector search.** SQLite + `sqlite-vec`. Events and the behavioural baseline live in a single local file. No cloud database, no connection string.
- **Behavioural baseline.** Each day's event stream is compared by cosine similarity against a rolling 14-day window. The 30-day baseline corpus is pre-seeded (`backend/seed.py`).
- **Signal logic.** `backend/signals.py` is a deterministic, unit-tested state machine. It — not the LLM — decides green/amber/red. Reproducible every run.
- **Agent reasoning + false-alarm filter.** Gemma 4 produces the visible reasoning narrative and a logged "second opinion" that can downgrade likely false positives with an explicit rationale. It is advisory; it never overrides the rule layer.
- **Fall fast path.** Synchronous, dependency-free; fires the alert in <10s (typically <1s) without waiting on the LLM, the baseline, or the network.
- **Scenario accuracy gate.** `backend/tests/replay.py` feeds all four PRD §7 scenarios through `ingestion.process_event` and asserts ≥26/32 signal classifications (8 signals × 4 scenarios). Four amber-by-absence cells are scored as real misses — see `GAP/ALLOWANCE` in the test file.
- **Voice deviation module.** `backend/voice_checkin.py` computes a normalized per-field deviation index (not true embedding cosine) with a passthrough guard for simulator-injected values.
- **Dashboard + live pipeline.** Next.js dashboard, FastAPI + SSE, floor-plan radar view, scenario player — all driven by the same `/ingest` pipeline a real sensor would use.

## 🟡 Mocked (one seam, clearly labelled)

- **The radar sensor input.** `data/sim/radar_simulator.py` generates synthetic radar events (presence, room transitions, fall, overnight vitals, second-person/helper detection) on a scenario timeline. It emits the **exact event schema the real ESP32 firmware produces** (`{event_type, source, room, timestamp, confidence, payload}`), so the entire downstream pipeline is production-faithful.
- **Why mocked:** time/hardware constraints for a two-person team, and we cannot safely stage a real fall. The production sensing path is fully designed in `hardware/` (sensor selection, wiring, ESP32 firmware sketch, MQTT topic map). Nothing downstream changes when a real ESP32 replaces the simulator — it posts to the same `POST /ingest` endpoint.

## ❌ Not present / out of scope for the hackathon

- No real wearable, EHR, or hospital integration is connected.
- No FHIR export or EHR/hospital integration is implemented (formerly considered, out of scope).
- No live mmWave hardware is run during the demo.
- No Cantonese voice check-in yet (roadmap v1).

---

## Verify the claims yourself

1. **Privacy:** start the demo, then disconnect Wi-Fi/Ethernet. Signals, reasoning, and fall alerts continue. Nothing was talking to the cloud.
2. **Determinism:** run a scenario twice via the scenario player (or standard tests); the signal-state sequence is identical.
3. **No secrets:** `git log --all --full-history -- .env` is empty; `.env.example` contains only local paths/hosts (`OLLAMA_HOST`, `DB_PATH`, `BACKEND_URL`) plus optional WeCom/WhatsApp dispatch placeholders — no cloud AI keys.
4. **Accuracy:** `pytest` runs 140 unit and integration tests, including the `replay.py` scenario accuracy gate and `voice_checkin.py` deviation module.

The one thing we simulated is the radio wave. The thing that genuinely works is everything that turns it into care.
