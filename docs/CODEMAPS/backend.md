<!-- Generated: 2026-06-07 | Files scanned: 16 | Token estimate: ~950 -->

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

## Routes — mock_server.py (port 8001, 313 ln)

```
GET  /health    GET /events (SSE)    POST /scenario/{name}
```
Zero deps. Pre-baked SSE timelines for all 3 scenarios. Mar's dev target + SSE contract reference.

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
3. db._write_event(rec) INSERT OR IGNORE  → dedup; returns False = duplicate → []
4. presence_update SSE  (presence_detected / presence_ended)
5. location.process_location(rec)    → location_update | wandering_detected SSE
6. signals.update_signal_state(rec)  → signal_update SSE(s)
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
Thread-safe (threading.Lock). Cold-start: cosine_update with simulator-supplied value always runs.

## connection.py (340 ln) — NEW FEATURE

```
compute_connection_window(prefs) → dict
  1. _quiet_waking_hours(conn)      → recurring presence hours (14-day window)
  2. _voice_quality_by_hour(conn)   → avg clarity + sentiment per hour
  3. _rank_hours(...)               → score = presence_freq × voice_clarity
  4. _intersect(ranked, prefs)      → intersect with child's declared free windows
  5. _build_result(...)             → {best_window, score, rationale, alternatives[]}

load_prefs(path) → dict             reads connection_prefs.json
```
Config: `CONNECTION_BASELINE_DAYS=14`, `CONNECTION_WINDOW_START_H=10`, `CONNECTION_WINDOW_END_H=20`, `CONNECTION_MIN_PRESENCE_FREQ=3`.

## Dispatch — _dispatch_alert() (main.py)

Tiered delivery: **WeCom webhook (primary, 4s timeout)** → **WhatsApp Business API (fallback)** → **overlay_only** (always renders). Returns `"wecom"`, `"whatsapp"`, or `"overlay_only"` as the `channel` field in SSE `intervention_ack` / `connection_ack`.

WeCom uses `POST https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...` (Markdown text, 4096-char limit). Works in mainland China without VPN — critical for Shenzhen/GBA caregivers.

## agent.py — Gemma 4 Hybrid Inference (409 ln)

```
maybe_assess(signal_state, broadcast)
  → first red/amber signal with updated_at
  → _cached(signal, state)      # O(1); 6 pre-generated entries keyed by (scenario, signal, state)
  → _live_assess(signal, state) # Ollama tool-call loop, max 4 rounds
  → minimal placeholder

fall_interrupt(room, posture, stationary_s, confidence)
  → immediate cached reasoning, no LLM call

Tools: get_signal_states() · get_cosine_distance(signal) · get_recent_events(hours, event_type?)
```

## HAS_TANMAY import gate

```python
# main.py:48-55
try:
    from ingestion import process_event as _tanmay_ingest
    from signals   import update_signal_state as _tanmay_signals
    HAS_TANMAY = True
except ImportError:
    HAS_TANMAY = False
```
ImportError on either → full fallback. Currently: `HAS_TANMAY = True`.

## Tests (4 test files, 115 tests)

```
backend/tests/
  conftest.py          autouse reset_main_state; async client fixture
  prd_constants.py     PRD_SIGNALS, PRD_STATES, PRD_ROOMS, PRD_SCENARIOS
  test_ingest.py       signal transitions, SSE schema, fall fast-path, _ingest_and_broadcast sync
  test_routes.py       route compliance, response shapes, scenario player
  test_agent.py        cache coverage, fall interrupt, tool schema
  test_connection.py   connection window logic (new, 291 ln)
```

## Key files

`backend/main.py` (771 ln) · `backend/agent.py` (409 ln) · `backend/connection.py` (340 ln)
`backend/mock_server.py` (313 ln) · `backend/ingestion.py` (268 ln) · `backend/seed.py` (241 ln)
`backend/signals.py` (224 ln) · `backend/db.py` (159 ln) · `backend/location.py` (133 ln)
`backend/baseline.py` (119 ln) · `backend/edge_processor.py` (80 ln) · `backend/config.py` (53 ln)
