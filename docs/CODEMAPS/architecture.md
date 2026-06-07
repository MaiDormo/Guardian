<!-- Generated: 2026-06-07 | Files scanned: 62 | Token estimate: ~750 -->

# Guardian — System Architecture

On-device eldercare AI. mmWave radar + GPS + voice → 8 daily signals + fall interrupt.
Zero cloud egress: Gemma 4 (Ollama) + SQLite + sqlite-vec all run on the family's laptop.

## Components (current status)

| Component | Path | Owner | Status |
|---|---|---|---|
| FastAPI backend + SSE | `backend/main.py` | Elia | ✅ 804 ln, 8 routes |
| Mock SSE server | `backend/mock_server.py` | Elia | ✅ 313 ln |
| Gemma 4 agent | `backend/agent.py` | Elia | ✅ 409 ln |
| Connection window inference | `backend/connection.py` | Elia | ✅ 340 ln |
| Radar simulator | `data/sim/radar_simulator.py` | Elia | ✅ 396 ln |
| Ingestion + dedup | `backend/ingestion.py` | Tanmay | ✅ 268 ln |
| Signal state machine | `backend/signals.py` | Tanmay | ✅ 224 ln |
| Voice deviation module | `backend/voice_checkin.py` | Tanmay | ✅ passthrough + weighted index |
| SQLite schema | `backend/db.py` | Tanmay | ✅ 159 ln |
| Location / DBSCAN | `backend/location.py` | Tanmay | ✅ 133 ln |
| Baseline (cosine pass-thru) | `backend/baseline.py` | Tanmay | ✅ 119 ln |
| Config constants | `backend/config.py` | Shared | ✅ 63 ln |
| Edge normalisation | `backend/edge_processor.py` | Tanmay | ✅ 80 ln |
| Seed (30-day baseline) | `backend/seed.py` | Tanmay | ✅ 241 ln |
| Replay accuracy gate | `backend/tests/replay.py` | Tanmay | ✅ 32-cell PRD §7 gate |
| Hardware design | `hardware/` | Tanmay | ✅ README + ESP32 sketch (not deployed) |
| Next.js dashboard | `web/` | Mar + Elia | ✅ Abstract Zone Map, SSE-wired |

**Backend: ~2,900 ln production code. Tests: ~1,900 ln (8 test files, 140 tests).**

## Runtime data flow

```
SENSOR (simulated)                BACKEND :8000                     FRONTEND :3000
radar_simulator.py                                                   Next.js App
   │                              ┌─────────────────────────┐        │
   └──POST /ingest───────────────►│ _ingest_and_broadcast() │        │
                                  │   HAS_TANMAY=True:       │        │
                                  │   process_event() ──────►│        │
                                  │   (edge→voice→db→signals)│        │
                                  │                          │◄─SSE──│ useSSE hook
                                  │   agent.maybe_assess()  │        │ SignalGrid
                                  │   → reasoning_update    │        │ ZoneMap
                                  │                          │        │ FallBanner
                                  │ connection.py            │        │ ReasoningPanel
                                  │   GET /api/connection-  │        │ ScenarioPlayer
                                  │       window            │        │
                                  └─────────────────────────┘        │
                                           │
                                     guardian.db (SQLite + sqlite-vec)
                                     Ollama host (gemma4:e4b + nomic-embed-text)

PRODUCTION (designed, not deployed):
  ESP32-S3 + mmWave → same JSON schema → POST /ingest (or MQTT bridge)
  See hardware/README.md
```

## The one mocked seam

Only **sensor input** is synthetic (`radar_simulator.py`). Everything downstream of `POST /ingest` is production-faithful — same event schema a real ESP32 would post. Pull ethernet during demo: Guardian keeps reasoning.

## See also
`backend.md` · `data.md` · `dependencies.md` · `frontend.md`
