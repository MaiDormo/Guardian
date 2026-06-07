<!-- Generated: 2026-06-07 | Files scanned: 18 | Token estimate: ~980 -->

# Backend Architecture

FastAPI + SSE. Python 3.12. SQLite on disk. Ollama on host.

## Routes — main.py (port 8000, 771 ln)

```
GET  /health                   → {status, clients, fall_active}
GET  /status                   → {on_device, model, bytes_to_cloud:0, ollama_running, signals{8}}
POST /ingest                   → IngestEvent → _ingest_and_broadcast → 200
GET  /events                   → SSE stream; snapshots non-unknown signals on connect
POST /scenario/{name}          → reset state + run timeline; valid={normal, trend_7day, fall}
POST /trigger/intervention     → _dispatch_alert() → WeCom → WhatsApp → overlay_only + intervention_ack SSE
GET  /api/connection-window    → compute + broadcast best-call-window for child
POST /trigger/connection       → _dispatch_alert() → WeCom → WhatsApp → overlay_only + connection_ack SSE
```

## Core ingest pipeline

```
POST /ingest → _ingest_and_broadcast(event):
  if HAS_TANMAY:
    sse_events = asyncio.to_thread(process_event, event)   ← Tanmay (SYNC)
  else:
    sse_events = _process_event_inplace(event)              ← in-memory fallback
  for e in sse_events:
    if signal_update: sync signal_state dict
    if fall_detected: set fall_active = True
    _broadcast(e) → per-client asyncio.Queue (maxsize 64)
  agent.maybe_assess(signal_state, _broadcast)             ← non-blocking, skips fall
```

## process_event() — ingestion.py (268 ln)

```
1. fall fast-path → [fall_detected SSE, presence_update(fall=True)]  NO signal_update
2. edge_processor.normalize(event)   → rec + dedup_key(uuid4) + seq
3. voice_checkin.enrich_event(rec)   → passthrough or compute baseline_deviation_cosine
4. db._write_event(rec) INSERT OR IGNORE  → dedup; returns False = duplicate → []
5. presence_update SSE  (presence_detected / presence_ended)
6. location.process_location(rec)    → location_update | wandering_detected SSE
7. signals.update_signal_state(rec)  → signal_update SSE(s)
```

## voice_checkin.py — deviation module

```
Passthrough guard: if payload.baseline_deviation_cosine is numeric → return verbatim
Compute path: 14-day voice_checkins baseline; cold-start gates (7 days, 5 samples)
Weighted fold: clarity 0.30, latency 0.30, speech_rate 0.20, confusion 0.20
Latency backstop: max(relative, absolute ≥3.0s); confusion floor 0.85
enrich_event() called from ingestion only — main._process_event_inplace unchanged
```

## Signal state machine — signals.py (224 ln)

```
presence_detected(bedroom, 5≤h≤11)   → woke_up green
presence_detected(kitchen, dwell≥300) → ate green
presence_detected(kitchen, 0<dwell)   → ate amber
dispenser_opened                       → took_meds green
dispenser_missed                       → took_meds red
breathing_update(in_baseline=T)        → rested_well green / amber
multi_presence_detected                → helper_present green
voice_checkin_completed(confusion=F)   → voice_checkin green
voice_distress_detected                → voice_checkin red  (cosine=baseline_deviation_cosine)
location_update(cluster_match=T)       → location green
location_update(cluster=F, score>0.15) → location amber
wandering_detected                     → location red
cosine_update(<0.15)                   → routine green
cosine_update(0.15–0.25)              → routine amber
cosine_update(≥0.25)                  → routine red
fall_detected                          → (fast-path in ingestion; no signal_update)
```

## Tests (8 test files, 140 tests)

```
backend/tests/
  conftest.py              autouse reset_main_state; async client fixture
  prd_constants.py         PRD_SIGNALS, PRD_STATES, PRD_ROOMS, PRD_SCENARIOS
  test_ingest.py           signal transitions, SSE schema, fall fast-path
  test_routes.py           route compliance, response shapes, scenario player
  test_agent.py            cache coverage, fall interrupt, tool schema
  test_connection.py       connection window logic
  test_synthetic_voice.py  voice_normal.json + voice_distress.json schema pins
  test_voice_checkin.py    passthrough, compute, enrich_event, ingestion hook (20 tests)
  replay.py                PRD §7 32-cell accuracy gate (≥26/32)
```

## Key files

`backend/main.py` · `backend/agent.py` · `backend/connection.py` · `backend/ingestion.py`
`backend/voice_checkin.py` · `backend/signals.py` · `backend/seed.py` · `backend/db.py`
`backend/tests/replay.py` · `hardware/README.md`
