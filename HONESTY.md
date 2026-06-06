# HONESTY.md

Guardian is a privacy-first eldercare system: millimetre-wave radar → on-device AI → five plain-language daily wellbeing signals + immediate fall alerts. No cameras, no cloud.

This document states plainly what is **real** and what is **mocked**, per the hackathon's honesty requirement. We draw exactly **one mocked seam** — the sensor input — and everything downstream genuinely runs.

---

## ✅ Real (genuinely working, no fakery)

- **On-device LLM.** Gemma 4 (E4B; E2B fallback) runs locally via Ollama. All inference is on the demo machine — **zero network egress**. You can verify this by disconnecting the network mid-demo: Guardian keeps reasoning. The "On-device · 0 bytes to cloud" badge is literally true.
- **Local datastore + vector search.** SQLite + `sqlite-vec`. Events and the behavioural baseline live in a single local file. No cloud database, no connection string.
- **Behavioural baseline.** Each day's event stream is embedded locally with `nomic-embed-text` and compared by cosine similarity against a rolling 14-day window. The 30-day baseline corpus is pre-seeded (`backend/seed.py`).
- **Signal logic.** `backend/signals.py` is a deterministic, unit-tested state machine. It — not the LLM — decides green/amber/red. Reproducible every run.
- **Agent reasoning + false-alarm filter.** Gemma 4 produces the visible reasoning narrative and a logged "second opinion" that can downgrade likely false positives with an explicit rationale. It is advisory; it never overrides the rule layer.
- **Fall fast path.** Synchronous, dependency-free; fires the alert in <10s (typically <1s) without waiting on the LLM, the baseline, or the network.
- **FHIR export.** `backend/fhir.py` emits a real FHIR R4 Observation bundle + a one-page report for any red signal.
- **Dashboard + live pipeline.** Next.js dashboard, FastAPI + SSE, floor-plan radar view, scenario player — all driven by the same `/ingest` pipeline a real sensor would use.
- **Validation.** `tests/replay.py` replays each scenario through the real pipeline and asserts the emitted signal states against a fixed ground-truth table. Reported accuracy: see CI output.

## 🟡 Mocked (one seam, clearly labelled)

- **The radar sensor input.** `data/sim/radar_simulator.py` generates synthetic radar events (presence, room transitions, fall, overnight vitals, second-person/helper detection) on a scenario timeline. It emits the **exact event schema the real ESP32 firmware produces** (`{event_type, source, room, timestamp, confidence, payload}`), so the entire downstream pipeline is production-faithful.
- **Why mocked:** time/hardware constraints for a two-person team, and we cannot safely stage a real fall. The production sensing path is fully designed in `hardware/` (sensor selection, wiring, ESP32 firmware sketch, MQTT topic map). Nothing downstream changes when a real ESP32 replaces the simulator — it posts to the same `POST /ingest` endpoint.

## ❌ Not present / out of scope for the hackathon

- No real wearable, EHR, or hospital integration is connected (the FHIR export is a standards-compliant output, not a live EHR write).
- No live mmWave hardware is run during the demo.
- No Cantonese voice check-in yet (roadmap v1).

---

## Verify the claims yourself

1. **Privacy:** start the demo, then disconnect Wi-Fi/Ethernet. Signals, reasoning, and fall alerts continue. Nothing was talking to the cloud.
2. **Determinism:** run a scenario twice via the scenario player (or `tests/replay.py`); the signal-state sequence is identical.
3. **No secrets:** `git log --all --full-history -- .env` is empty; `.env.example` contains only local paths/hosts (`OLLAMA_HOST`, `DB_PATH`, `MQTT_BROKER`).
4. **Accuracy:** `python -m tests.replay` prints the 15-cell pass matrix and overall signal accuracy.

The one thing we simulated is the radio wave. The thing that genuinely works is everything that turns it into care.
