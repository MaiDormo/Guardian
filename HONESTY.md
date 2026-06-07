# HONESTY.md

> Mandatory disclosure for the hackathon. This file lives at the root of your repository. Judges cross-check it against your code and your technical video.
>
> **The deal:** disclosed shortcuts are **not** penalized — that is the entire point of this file. Hidden ones are. Undisclosed pre-built code is heavily penalized, each undisclosed mock carries a small penalty, and a faked demo is heavily penalized. Telling the truth here costs you nothing.

---

## 1. Team — who did what
Judges compare this against `git shortlog -sn`, so keep it honest.

| Member | GitHub handle | Main contributions |
|---|---|---|
| Tanmay | N/A (no GitHub handle in commits) | Backend: agent.py, signals.py, ingestion.py, db.py, baseline.py, voice_checkin.py, connection.py, location.py, seed.py, replay tests, ESP32 firmware sketch, radar simulator, event schema design, PRD |
| maidormo | @MaiDormo | Frontend: Next.js dashboard, SSE integration, floor-plan view, scenario player, intervention UI, deployment config (Docker, Vite), docs |
| marminguez | @marminguez | Minor fix / polish commit |

---

## 2. What is fully working
Features that run end-to-end on the live app, with real data and real logic. Be specific: name the feature, what input it takes, what output it produces.

- **On-device LLM reasoning.** Gemma 4 (E4B; E2B fallback) runs locally via Ollama. Takes radar events + baseline context, produces structured reasoning narrative and false-alarm second opinion. Zero network egress — verifiable by disconnecting the network mid-demo.
- **Behavioural baseline + cosine-similarity comparison.** Each day's event stream is embedded via `nomic-embed-text` (768-dim) and compared against a rolling 14-day window. Output: per-signal anomaly scores. 30-day corpus pre-seeded via `backend/seed.py`.
- **Deterministic signal state machine.** `backend/signals.py` — 8 wellbeing signals (woke_up, ate_meal, took_meds, rested_well, mobile, socialised, mood_stable, bathroom_regular) each have a unit-tested state machine producing green/amber/red. Reproducible identically on every run.
- **Fall fast path.** Synchronous, dependency-free alert path that fires a fall alert in <10s (typically <1s) without waiting on the LLM, the baseline, or the network.
- **Scenario accuracy gate.** `backend/tests/replay.py` feeds all four PRD §7 scenarios through `ingestion.process_event` and asserts ≥26/32 correct signal classifications. Four amber-by-absence cells are scored as real misses — see section 6.
- **Voice deviation module.** `backend/voice_checkin.py` computes normalized per-field deviation index against baseline with a passthrough guard for simulator-injected values.
- **Live dashboard.** Next.js app with SSE-driven real-time signal cards, floor-plan radar view, scenario player, reasoning console, and connection-window overlay — all driven by the same `/ingest` endpoint a real sensor would use.
- **Local datastore + vector search.** SQLite with WAL mode + `sqlite-vec` for vector similarity. Events, baselines, and signals in a single local file. No cloud database, no connection string.
- **Connection-window logic.** Familial bond detection + dynamic presence-based connection-window extension, visualised on the dashboard.
- **290+ unit/integration tests.** 171 backend tests (pytest, including replay accuracy gate and voice checkin deviation) + 120 frontend tests (Vitest, including SSE, signal logic, and scenario player).

---

## 3. What is mocked, stubbed, or hardcoded
Every shortcut. Examples: a login that accepts any password, a payment that always succeeds, an "AI" that is an if/else, a database that is an in-memory dictionary, fake JSON returned instead of a real API call.

**Undisclosed mocks carry a small penalty each. Anything you list here = free.**

| What is faked | Where (file:line or folder) | Why we mocked it | What the real version would do |
|---|---|---|---|
| Radar sensor input | `data/sim/radar_simulator.py` | Time/hardware: cannot safely stage a real fall; mmWave dev kit not available for a 2-person team | ESP32 firmware posting real mmWave radar events over MQTT → `POST /ingest` (same endpoint, same event schema) |
| Caregiver dispatch (WeCom) | `backend/main.py:718-742` | Optional channel — WhatsApp is our primary; WeCom key would need a real WeCom enterprise account | Authenticated POST to WeCom webhook with alert text |
| Caregiver dispatch (WhatsApp) | `backend/main.py:746-765` | Sandbox keys only — real WhatsApp Business API requires Meta-verified phone number | Authenticated POST to Facebook Graph API with verified token |
| ESP32 firmware sketch | `hardware/esp32_firmware.ino` | No physical hardware to flash or test | Runs on ESP32 with Seeed MR60FDA1 (fall) + MR60BHA2 (breathing) + LD2410 (presence) sensors |

If nothing is mocked, write: *"Nothing is mocked — every feature listed above uses real logic and real data."*

---

## 4. External APIs, services & data sources
Everything the project calls or pretends to call. Mark each as real or mocked.

| Service / API / dataset | Used for | Real call or mocked? | Auth (sandbox / test key / none) |
|---|---|---|---|
| Ollama (localhost:11434) | LLM inference (Gemma 4) + embeddings (nomic-embed-text) | Real | None (local) |
| SQLite + sqlite-vec | Local event store, baseline, vector search | Real | None (local file) |
| WeCom webhook | Alert dispatch to mainland China caregivers | Real call, but key is a placeholder | Placeholder key (`YOUR_KEY_HERE`) |
| WhatsApp Business API | Alert dispatch to HK-side family | Real call, but sandbox/test-mode | Sandbox token (env var `WHATSAPP_TOKEN`) |
| next/font/google | Fraunces + Source Sans 3 font loading | Real (Next.js built-in, fetched at build time) | None (public CDN) |
| Leaflet + OpenStreetMap tiles | Floor-plan / zone map rendering | Real | None (free tile layer, no API key) |
| MQTT broker | Bridging ESP32 → backend (design-time only, not wired) | Not wired — design doc only | None |

---

## 5. Pre-existing code
Anything written **before** kickoff that we brought into this project: prior personal projects, forked open-source code, templates, boilerplate, internal libraries.

**Undisclosed pre-built code is heavily penalized. Anything you list here = free.**

| Item | Source (URL or description) | Roughly how much | License |
|---|---|---|---|
| Next.js app router boilerplate | Generated by `create-next-app` | ~5 files (layout.tsx, page.tsx globals.css, etc.) | MIT (Next.js) |
| TailwindCSS + PostCSS config | Standard `npx tailwindcss init` boilerplate | 2 config files | MIT (TailwindCSS) |
| Vite + Vitest config | Standard boilerplate for Vite React project | 2 config files | MIT (Vite) |
| Docker Compose + Dockerfiles | Standard multi-service compose pattern | 3 files | MIT |
| MIT License template | Standard open-source MIT license text | 1 file | N/A |

All application logic — backend (agent, signals, ingestion, baseline, db, voice_checkin, connection, location, seed, tests), frontend (components, SSE hooks, scenario player, floor-plan view), hardware (ESP32 firmware), data simulator, radar event schema, PRD, and all other files — was written from scratch during the hackathon window.

---

## 6. Known limitations & next steps
What we would build next, and the weak spots we already know about. Naming these honestly is a strength, not a flaw.

- **4 unreachable amber cells in accuracy gate.** The `replay.py` test scores 4 cells as real misses because `signals.py` has no amber path for `woke_up` in `trend_7day` (3 cells) and `voice_distress` (1 cell) scenarios. Threshold is ≥26/32 passing. Fix: add amber thresholds for these signal/scenario combinations.
- **sqlite-vec extension loading.** Python's stdlib `sqlite3` is often compiled without `loadable-extension` support. `enable_load_extension()` may raise `AttributeError` on some platforms. Workaround documented in `backend/db.py`.
- **ESP32 firmware untested on real hardware.** The `esp32_firmware.ino` sketch is written per datasheet but has never been flashed or run. MQTT broker is not wired.
- **No Cantonese voice check-in.** The voice deviation module exists, but a full Cantonese ASR + NLU pipeline for voice check-in is not implemented (roadmap v1).
- **No real-world validation.** Radar event patterns (presence, room transitions, fall, overnight vitals) are generated by a simulator, not from real sensor data. Accuracy against real eldercare environments is unvalidated.
- **No FHIR/EHR or hospital integration.** Export to healthcare standards is not implemented.
