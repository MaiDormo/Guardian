# Guardian

**Camera-Free, On-Device AI for Cross-Border Elderly Care**

Guardian turns passive mmWave radar sensors into eight human-readable daily signals for a family member monitoring an elderly parent living alone across the border. All reasoning runs locally — no cloud, no camera, no audio.

> Built at StartHack Hong Kong 2026.

---

## Prerequisites

Guardian runs entirely on your machine. You need:

- **Docker + Docker Compose** — for the app stack
- **Ollama** — for the on-device LLM and embeddings (runs on the host, outside Docker)
- **≥16GB RAM** recommended for Gemma 4 E4B

### 1. Install Ollama and pull models

```bash
# Install Ollama: https://ollama.com
ollama pull gemma4:e4b
ollama pull nomic-embed-text
```

This is a one-time download (~a few GB). Ollama must be running before you start the stack.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if you want WeCom/WhatsApp dispatch (optional — dashboard overlay works without it)
```

### 3. Start everything

```bash
docker compose up --build
```

Open **http://localhost:3000** in ~90 seconds.

---

## Demo

The dashboard has three scenario buttons in the bottom panel:

| Button | What it shows |
|--------|--------------|
| **▶ Normal Morning** | All 8 signal cards turn green. Zone map shows bedroom → bathroom → kitchen. Reasoning panel: cosine distance 0.04. |
| **▶ 7-Day Trend** | 7-day drift at demo speed. Voice and Location go red on Day 7. Routine cosine climbs to 0.38. Intervention Trigger slides in. |
| **🚨 Fall Override** | Immediate fall detection. Bathroom pulses red. Full-width banner. Reasoning: "Priority interrupt — bypassed agent loop." |

### Proving on-device operation

Pull the ethernet cable at any point — Guardian keeps reasoning. The `[● Running On-Device · Gemma 4 · 0 Bytes to Cloud]` badge in the top corner is wired to `GET /status`, which checks Ollama on localhost and confirms zero outbound connections.

---

## Architecture

```
DEMO MACHINE (localhost)
├── Ollama (host)                  gemma4:e4b + nomic-embed-text
│
├── FastAPI backend  :8000
│   ├── /ingest                    receives sensor events (radar, GPS, voice, pill dispenser)
│   ├── /events                    SSE stream → dashboard
│   ├── /scenario/{name}           plays scripted demo timeline
│   ├── /trigger/intervention      WeCom → WhatsApp → overlay fallback
│   └── /status                    on-device verification (badge data)
│
└── Next.js dashboard  :3000
    ├── 8 signal cards             green/amber/red states via SSE
    ├── Abstract Zone Map          room presence blips
    ├── SVG location map           Glowing Heatmap Trace Layer
    ├── Reasoning panel            Gemma 4 rationale per signal
    └── Intervention Trigger       one-button caregiver dispatch
```

**No hardware required for the demo.** `radar_simulator.py` emits the same event schema that real ESP32 + mmWave sensors would produce.

---

## The 8 Signals

| # | Signal | Source |
|---|--------|--------|
| 1 | Woke Up | mmWave presence (bedroom) |
| 2 | Ate | mmWave presence + dwell (kitchen) |
| 3 | Took Meds | Smart pill dispenser |
| 4 | Rested Well | MR60BHA2 breathing radar |
| 5 | Helper Present | mmWave multi-target detection |
| 6 | Voice Check-In | Daily automated call (speech features) |
| 7 | Location | GPS trajectory density vs baseline |
| 8 | Routine | Cosine similarity across all signals (sqlite-vec) |

Plus **Fall Detection** — a priority interrupt that bypasses the agent loop entirely and fires within 10 seconds.

---

## Running the simulator standalone

```bash
# Seed 30-day baseline
python data/sim/radar_simulator.py --scenario seed --days 30

# Play Normal Morning at real-time speed
python data/sim/radar_simulator.py --scenario normal

# Play 7-Day Trend at 30× speed
python data/sim/radar_simulator.py --scenario trend_7day --speed 30

# Fire fall override immediately
python data/sim/radar_simulator.py --scenario fall
```

---

## Running tests

```bash
pip install -r backend/requirements-dev.txt
pytest -v
```

140 tests covering PRD § 5.6 SSE schema compliance, all route contracts, signal state machine, agent cache, fall interrupt bypass, voice deviation module, synthetic voice data, and the `replay.py` 32-cell accuracy gate.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| On-device LLM | Gemma 4 E4B via Ollama |
| Embeddings | nomic-embed-text via Ollama |
| Vector search | SQLite + sqlite-vec (cosine similarity) |
| Backend | FastAPI + SSE (Python 3.12) |
| Frontend | Next.js + TailwindCSS |
| Deployment | Docker Compose |

---

## Privacy

Guardian produces no images and no audio recordings. mmWave radar detects presence, motion, and breathing as structured events — physically incapable of producing footage. All data stays in a single SQLite file on your machine. Gemma 4 reasons locally. Zero bytes leave the device.
