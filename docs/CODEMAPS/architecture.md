<!-- Generated: 2026-06-07 | Files scanned: 54 | Token estimate: ~700 -->

# Guardian — System Architecture

On-device eldercare AI. mmWave radar + GPS + voice → 8 daily signals + fall interrupt.
Zero cloud egress: Gemma 4 (Ollama) + SQLite + sqlite-vec all run on the family's laptop.

## Components (current status)

| Component | Path | Owner | Status |
|---|---|---|---|
| FastAPI backend + SSE | `backend/main.py` | Elia | ✅ 804 ln, 8 routes |
| Mock SSE server | `backend/mock_server.py` | Elia | ✅ 313 ln |
| Gemma 4 agent | `backend/agent.py` | Elia | ✅ 409 ln |
| Connection window inference | `backend/connection.py` | Elia | ✅ 340 ln (new feature) |
| Radar simulator | `data/sim/radar_simulator.py` | Elia | ✅ 396 ln |
| Ingestion + dedup | `backend/ingestion.py` | Tanmay | ✅ 268 ln |
| Signal state machine | `backend/signals.py` | Tanmay | ✅ 224 ln |
| SQLite schema | `backend/db.py` | Tanmay | ✅ 159 ln |
| Location / DBSCAN | `backend/location.py` | Tanmay | ✅ 133 ln |
| Baseline (cosine pass-thru) | `backend/baseline.py` | Tanmay | ✅ 119 ln |
| Config constants | `backend/config.py` | Shared | ✅ 53 ln |
| Edge normalisation | `backend/edge_processor.py` | Tanmay | ✅ 80 ln |
| Seed (30-day baseline) | `backend/seed.py` | Tanmay | ✅ 241 ln |
| Next.js dashboard | `web/` | Mar + Elia | ✅ 12 active components (ZoneMap replaces FloorPlan; BottomNav/Fab dormant), fully wired to SSE |
| Voice module | `backend/voice_checkin.py` | Eleoner | ⛔ not started |

**Backend: ~2,800 ln production code. Tests: ~1,580 ln (5 test files, 115 tests).**

## Runtime data flow

```
SENSOR (simulated)                BACKEND :8000                     FRONTEND :3000
radar_simulator.py                                                   Next.js App
   │                              ┌─────────────────────────┐        │
   └──POST /ingest───────────────►│ _ingest_and_broadcast() │        │
                                  │   HAS_TANMAY=True:       │        │
                                  │   process_event() ──────►│        │
                                  │   (edge→db→signals→loc) │        │
                                  │                          │◄─SSE──│ useSSE hook
                                  │   agent.maybe_assess()  │        │ SignalGrid
                                  │   → reasoning_update    │        │ LocationMap
                                  │                          │        │ FallBanner
                                  │ connection.py            │        │ ReasoningPanel
                                  │   GET /api/connection-  │        │ InterventionTrigger
                                  │       window            │        │ ScenarioPlayer
                                  └─────────────────────────┘        │ ZoneMap + ConnectionCard
                                           │
                                     guardian.db (SQLite + sqlite-vec)
                                     Ollama host (gemma4:e4b + nomic-embed-text)
```

## The one mocked seam

Only **sensor input** is synthetic (`radar_simulator.py`). Everything downstream of `POST /ingest` is production-faithful — same event schema a real ESP32 would post. Pull ethernet during demo: Guardian keeps reasoning.

## Open items

- ⛔ `voice_checkin.py` (Eleoner) — not started; `voice_checkin` signal currently driven by fallback only
- ❌ `replay.py` accuracy gate + FHIR export — cancelled / out of scope
- ✅ `HONESTY.md` — updated to remove stale claims (fhir.py, replay.py, 5 signals) and align with 8 signals

## See also
`backend.md` · `data.md` · `dependencies.md` · `frontend.md`
