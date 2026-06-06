# Guardian Data Layer — Implementation Plan (Tanmay)

> Owner: Tanmay · Project: Guardian (18h hackathon MVP, on-device eldercare) · Date: 2026-06-06
> Scope: `backend/ingestion.py`, `backend/edge_processor.py`, `backend/baseline.py`, `backend/signals.py`, `backend/location.py`, `backend/db.py`, `backend/config.py`, `backend/seed.py` (new — see §9.10), `data/synthetic/gps_normal.json`, `data/synthetic/gps_wander.json`, `backend/tests/replay.py`
> Stack: FastAPI + SQLite + sqlite-vec + Ollama (nomic-embed-text 768-dim) + numpy + scikit-learn (DBSCAN). All on-device, zero cloud egress.

---

## 1. Executive Summary

You are building the entire **on-device data layer** behind a FastAPI/SSE harness that **already exists and works**. Elia's `backend/main.py` (615 lines), `agent.py`, `mock_server.py`, and `data/sim/radar_simulator.py` are done; **none of your 5 core modules exist yet**, and `main.py` already declares the exact seam it will import you into.

**The one hard constraint:** your code must slot into the existing harness without breaking it, and produce **SSE output that matches Elia's in-memory fallback `_process_event_inplace`**, because the existing test suite (`backend/tests/` — **88 test functions, 90 cases collected after parametrization**) pins every event→signal→state→SSE-field mapping against that fallback. When your `ingestion.process_event` and `signals.update_signal_state` both import cleanly, `main.py` flips `HAS_TANMAY=True` (verified at `main.py:48-55`) and routes live traffic through your code instead. If your code diverges or raises, `main.py` silently falls back (`main.py:380-383`) — so a subtle bug looks like "it works." You self-test by writing `replay.py` and equivalence tests; runtime errors won't surface in the existing suite.

> **Mandate nuance (resolved — see §3 and §9.6):** "match the fallback" is the governing rule for every SSE envelope **that a test asserts** (signal_update, presence_update, fall_detected, wandering_detected) and for the signal/state/room strings Mar consumes. The one envelope where the fallback and PRD §5.6 **diverge** is `location_update` (fallback keeps `lat`/`lng`; PRD §5.6 frontend form drops them). **No test pins location_update's key-set**, so this is a genuine choice, not a dual-satisfiable constraint. **Decision: mirror the fallback exactly** (`{**payload, "updated_at": now}`, lat/lng included) to honor the byte-identical mandate and Mar's contract-of-record. Do not claim both PRD §5.6 and byte-identical-to-fallback are simultaneously satisfied for location_update — they are not.

**Build order, in one breath:** `config.py` constants → `db.py` schema + sqlite-vec load → `edge_processor.py` normalisation → `signals.py` state machine (the accuracy-critical piece) → `ingestion.py` (the load-bearing `process_event` that wires it all and returns SSE) → `location.py` DBSCAN/wandering → `baseline.py` embeddings (pass-through first, live cosine as stretch) → `gps_normal.json` + `gps_wander.json` → `seed.py` (30-day preload) → `replay.py` accuracy gate (≥26/32).

---

## 2. Current State & Integration Seam

### What already exists (verified on disk)
- `backend/main.py` — full Phase-1 backend, **all state in-memory module globals, NO SQLite anywhere**. Owns the SSE registry, `/ingest`, `/events`, `/status`, `/scenario/{name}`, the scenario runner, and the fallback rule engine.
- `backend/agent.py` — `GuardianAgent`, consumes `signal_state` (reads only `state` + `cosine_distance` per signal), emits `reasoning_update`. **Never imports your modules.**
- `backend/mock_server.py` — frozen reference SSE schema (the contract-of-record for Mar's frontend).
- `data/sim/radar_simulator.py` — emits the exact ESP32 wire schema and POSTs to `/ingest`.
- `data/synthetic/normal_morning.json`, `trend_7day.json` — Elia's scenarios.
- `backend/tests/` — `conftest.py`, `prd_constants.py`, `test_ingest.py` (27 functions), `test_routes.py` (26 functions, one parametrized over 3 scenarios → 28 cases), `test_agent.py` (35 functions). **Total: 88 functions, 90 collected.**
- `backend/requirements.txt` — **already lists `sqlite-vec>=0.1.6`, `numpy>=1.26.0`, `scikit-learn>=1.4.0`** (commit `d7daeb1`). `pytest` lives in `backend/requirements-dev.txt`. There is **no repo-root `requirements.txt`** — all dependency files are under `backend/`. You do **not** re-add deps.

### Where main.py plugs you in (the seam — load-bearing)
```python
# main.py:48-55 — the ONLY import of your code
try:
    from ingestion import process_event as _tanmay_ingest      # REQUIRED
    from signals  import update_signal_state as _tanmay_signals # REQUIRED (import-only gate)
    HAS_TANMAY = True
except ImportError:
    HAS_TANMAY = False
```
```python
# main.py:377-405 — the call site (_ingest_and_broadcast)
if HAS_TANMAY:
    try:
        sse_events = await asyncio.to_thread(_tanmay_ingest, event)   # SYNC fn, off event loop
    except Exception as exc:
        log.warning("Tanmay ingest error (%s) — falling back", exc)
        sse_events = await _process_event_inplace(event)
else:
    sse_events = await _process_event_inplace(event)

for sse_evt in sse_events:
    if sse_evt.get("event") == "signal_update":          # main re-syncs signal_state from YOUR events
        p = sse_evt["payload"]; sig = p.get("signal")
        if sig in signal_state:
            signal_state[sig] = {"state": p.get("state","unknown"), "reason": p.get("reason",""),
                                 "cosine_distance": p.get("cosine_distance"), "updated_at": p.get("updated_at")}
    await _broadcast(sse_evt)
```

**Critical facts from the seam:**
1. `process_event(event: dict) -> list[dict]` is **synchronous** (run via `asyncio.to_thread`). Blocking SQLite I/O is fine; **must NOT block on Ollama** for the demo path. **If you write `async def`, it returns a coroutine, iteration at `main.py:387` breaks, everything silently falls back.**
2. Each returned dict is a **fully-formed SSE envelope** `{"event": <type>, "payload": {...}}`. `main.py` does the `json.dumps` wrapping later (`main.py:510`) — **do not** wrap as `{"data": ...}`.
3. **You never touch `main.signal_state` directly.** `main.py` re-derives it from every `signal_update` payload you return (`main.py:391-400`). To move a badge, emit a `signal_update`. This sync is locked by regression test `test_ingest_and_broadcast_syncs_signal_state` (`test_ingest.py:496-533`), which exercises the live `_ingest_and_broadcast` path with a `dispenser_opened` event.
4. `signals.update_signal_state` is **imported but never called by main.py** (no call site exists). Its mere import gates `HAS_TANMAY`. **You must call your own state-machine logic from inside `process_event`** — do not assume main.py drives it.
5. **`HAS_TANMAY` is all-or-nothing:** if *either* module fails to import (incl. any import-time exception — e.g. opening `guardian.db` or loading sqlite-vec at module top level), the **entire** data layer reverts to fallback. **Open the DB and load sqlite-vec lazily inside `process_event`, never at module import.**

### What's stubbed/inline that you replace or back
- **`_process_event_inplace` (`main.py:125-233`)** — the fallback. This is your **behavioral oracle**: replicate its output per event type, then it becomes dead code on the live path. **Caveat:** the oracle is incomplete for two cells the PRD requires — see §3 (took_meds amber) and §9.
- **`agent.get_recent_events` (`agent.py:243-250`)** — returns `{"note": "SQLite not yet available — install Tanmay's baseline.py to enable", ...}`. Back it with a real `events` query (not test-blocking; needed for live reasoning).
- **`fall_active` flag** — set only inside the fallback's `global fall_active` (`main.py:216`). On the `HAS_TANMAY` path this is **never set**. ⚠️ **LIVE/DEMO GAP** (runtime only, not a test failure) — see §9.

### Reset gap (coordinate with Elia)
`/scenario/{name}` calls `_reset_state()` (`main.py:367-371`) which only reassigns `main.signal_state`/`fall_active`. It **does not touch your accumulators or DB**. Across `normal → trend_7day → fall`, your dwell counters / per-day cosine / baseline window will **bleed between scenarios**. **Expose `ingestion.reset_state()` and ask Elia to call it inside `_reset_state`.**

---

## 3. The Test Contract (TDD Target)

The existing tests call `main._process_event_inplace` (async) and the FastAPI routes — **not your modules yet**. But the same schema/threshold contracts apply once `HAS_TANMAY=True`. Code `process_event` to produce matching SSE.

### Required public APIs
| Module.function | Signature | Notes |
|---|---|---|
| `ingestion.process_event` | `def process_event(event: dict) -> list[dict]` | **SYNC.** Single load-bearing entry. Returns SSE envelopes. Must not raise on valid input. |
| `signals.update_signal_state` | `def update_signal_state(...) -> ...` | Must be **importable** (gates `HAS_TANMAY`). You define the signature; call it from `process_event`. |
| `ingestion.reset_state` | `def reset_state() -> None` | Reset hook for Elia to wire into `_reset_state`. |

### SSE payload schemas (exact keys — enforced by `test_ingest.py:30-65`)
```python
# assert_signal_update_schema (test_ingest.py:30-37) — ALL 5 keys required (cosine_distance may be None)
{"event":"signal_update","payload":{"signal":str,"state":str,"reason":str,"cosine_distance":float|None,"updated_at":str}}
# assert_presence_update_schema (40-46) — `fall` bool REQUIRED (not in PRD §5.6 JSON example)
{"event":"presence_update","payload":{"room":str,"occupied":bool,"fall":bool,"updated_at":str}}
# assert_fall_detected_schema (49-56)
{"event":"fall_detected","payload":{"room":str,"posture":str,"stationary_s":int,"confidence":float,"updated_at":str}}
# assert_wandering_detected_schema (59-65)
{"event":"wandering_detected","payload":{"trajectory_density_score":float,"baseline_cluster_match":bool,"minutes_outside_baseline_footprint":int,"updated_at":str}}
```

> **`location_update` is TEST-UNENFORCED.** There is **no** `assert_location_update_schema` in `test_ingest.py` (verified — the only four schema asserts are the ones above). The only hard constraint on the `location` path is the **signal_update** green/amber/red logic, not the `location_update` envelope key-set. **Decision (per §1 mandate nuance): emit the fallback's exact shape** — `{**payload, "updated_at": now}`, which keeps `lat`, `lng`, `distance_from_home_m`, `trajectory_density_score`, `baseline_cluster_match` (mirrors `main.py:194-196`). PRD §5.6's lat/lng-dropped "frontend form" is NOT used here; if the team later wants §5.6 form, Elia must change the fallback in both places so the two stay aligned.
```python
# location_update (chosen shape = fallback-identical, NOT test-enforced)
{"event":"location_update","payload":{ **original_payload, "updated_at":str}}
#   → in practice: {"lat":float,"lng":float,"distance_from_home_m":int,
#                   "trajectory_density_score":float,"baseline_cluster_match":bool,"updated_at":str}
```
- `signal` ∈ `PRD_SIGNALS` = `{woke_up, ate, took_meds, rested_well, helper_present, voice_checkin, location, routine}`
- `state` ∈ `PRD_STATES` = `{green, amber, red, unknown}`
- `room` ∈ `PRD_ROOMS` = `{bedroom, bathroom, kitchen, living_room}`
- `updated_at` = UTC ISO8601 (`datetime.now(timezone.utc).isoformat()`, matching `main._ts()`).

### Behavioral thresholds (pinned — replicate EXACTLY, verified in `main.py:125-233`)
| Event | Condition | Result |
|---|---|---|
| `presence_detected` room=bedroom | hour `5 <= h <= 11` | `woke_up` **green** + `presence_update(occupied=True,fall=False)` |
| `presence_detected` room=kitchen | `dwell_s >= 300` | `ate` **green** |
| `presence_detected` room=kitchen | `0 < dwell_s < 300` | `ate` **amber** |
| `presence_ended` | always | `presence_update(occupied=False,fall=False)` |
| `dispenser_opened` | always | `took_meds` **green** |
| `dispenser_missed` | always | `took_meds` **red** |
| `breathing_update` | `in_baseline=True` → green, else amber | `rested_well` |
| `multi_presence_detected` | always | `helper_present` **green** |
| `voice_checkin_completed` | `confusion_markers=False` → green, `True` → red | `voice_checkin` |
| `voice_distress_detected` | always | `voice_checkin` **red**, cosine = `payload.baseline_deviation_cosine` |
| `location_update` | `baseline_cluster_match=True`→green; else `density>0.15`→amber; else red | `location` + `location_update` SSE |
| `wandering_detected` | always | `location` **red** + `wandering_detected` SSE |
| `cosine_update` | `<0.15`→green; `<0.25`→amber; `>=0.25`→red | `routine`, cosine attached |
| `fall_detected` | always | `fall_detected` SSE + `presence_update(room=bathroom,fall=True)`, **ZERO signal_update**, set `fall_active=True` |

> **Oracle gap — `took_meds` amber:** the fallback (`main.py:157-163`) implements **only** `dispenser_opened→green` and `dispenser_missed→red`. It has **no amber path and no time-window logic.** PRD §5.1 row 3 defines `took_meds` AMBER = "no event by 11:00" and RED = "`dispenser_missed` OR window exceeded by >2h." The §7 accuracy table's **B-column `took_meds` = amber** is therefore **achievable only via the new amber-timeout machine (§5 signals.py)** — there is **no oracle to mirror** for this cell. Treat it as net-new logic, not a replication.

### Other locked invariants
- **Cold start:** `_empty_state()` seeds all 8 signals as `{state:"unknown", reason:"", cosine_distance:None, updated_at:None}` (`test_ingest.py:487-493`, `test_routes.py:209-221`).
- **Fall fast-path:** `test_ingest.py:147-196` asserts a `fall_detected` SSE + bathroom `presence_update(fall=True)`, and **zero** `signal_update`. `test_agent.py:141-163` asserts fall does **not** call the LLM.
- **State persistence:** after `dispenser_opened`, `main.signal_state['took_meds']['state'] == 'green'` (`test_ingest.py:471-484`). On the live path this happens via main's re-sync, not your code.
- **`/status`:** must return `on_device:True`, `model:"gemma4:e4b"`, `bytes_to_cloud:0`, and `signals` with exactly the 8 keys (`test_routes.py:39-64`).
- **Agent `maybe_assess`:** fires only for signals with `state ∈ (red,amber)` **AND truthy `updated_at`** (`agent.py:358-361`). Always set `updated_at` on amber/red or reasoning silently never fires.

### Test gaps / ambiguities (the explorers flagged these — you decide + add tests)
1. **No test covers your `process_event` path** — only the fallback. Add a parametrized equivalence layer importing `from ingestion import process_event` (see §10).
2. **`location_update` envelope is unenforced** — no schema assert exists. Your only hard constraint on that path is the location signal_update state logic (§7).
3. **`dedup_key` composition is undefined** anywhere (no test, no PRD). You define it (§4).
4. **`fall_active` under `HAS_TANMAY`** is unwired (§9) — a **runtime/demo** gap, **not** a test failure (`test_ingest.py:199-211` calls `_process_event_inplace` directly, which always sets the flag).
5. **Active vs passive sensor** classification for amber timeouts is unspecified. Proposed: `voice_system`, `pill_dispenser`, `gps_tracker` = **active (2h)**; all `mmwave_*` + `baseline` = **passive (4h)**.
6. **Cold-start routine state:** PRD §5.2 says "unknown"; §5.1 row 8 says "amber = insufficient baseline history." **Decision: use `unknown` for the routine card during days 1-7** (matches `_empty_state` + cleaner replay).

---

## 4. SQLite Schema (`backend/db.py`)

`DB_PATH = os.getenv("DB_PATH", "./guardian.db")` (docker: `/app/db/guardian.db`). Load sqlite-vec **defensively** (fall back to numpy cosine if the extension fails — PRD §13 risk).

> **Loadable-extension landmine (read before coding):** Python's stdlib `sqlite3` is frequently compiled **without** loadable-extension support (default Ubuntu `python3` among them). In that case `conn.enable_load_extension(True)` itself raises `AttributeError` or `sqlite3.OperationalError` **before** `sqlite_vec.load()` is ever reached. Per risk #1 this would silently disable the whole data layer if it leaked to import time. **Both** `enable_load_extension` **and** `sqlite_vec.load` must sit inside the **same** `try/except` (catching `AttributeError` and `sqlite3.OperationalError`), and the whole thing must run **lazily inside `process_event`**, never at module import. On failure, set a module flag and use the numpy cosine path.

```sql
-- events: every normalised raw event. dedup via UNIQUE dedup_key.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type  TEXT    NOT NULL,
    source      TEXT    NOT NULL,
    room        TEXT,                       -- nullable: absent for pill/voice/gps/baseline
    timestamp   TEXT    NOT NULL,           -- ISO8601 from the wire event
    confidence  REAL    NOT NULL DEFAULT 1.0,
    payload     TEXT    NOT NULL DEFAULT '{}',  -- JSON blob of the event payload
    dedup_key   TEXT    NOT NULL UNIQUE,        -- see dedup strategy below
    seq         INTEGER NOT NULL,            -- monotonic per-process counter (dedup tiebreak; see §4 dedup)
    ingested_at TEXT    NOT NULL                -- our receipt time (UTC ISO8601)
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, timestamp);

-- signals: current state machine snapshot, one row per signal.
CREATE TABLE IF NOT EXISTS signals (
    signal          TEXT PRIMARY KEY,        -- one of the 8 PRD signals
    state           TEXT NOT NULL DEFAULT 'unknown',  -- green|amber|red|unknown
    reason          TEXT NOT NULL DEFAULT '',
    cosine_distance REAL,                     -- nullable
    updated_at      TEXT,
    amber_since     TEXT                      -- ISO8601 when it first went amber (drives 4h/2h timeout)
);

-- locations: GPS points + DBSCAN-derived cluster metadata.
CREATE TABLE IF NOT EXISTS locations (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp                TEXT NOT NULL,
    lat                      REAL NOT NULL,
    lng                      REAL NOT NULL,
    distance_from_home_m     INTEGER,
    trajectory_density_score REAL,
    baseline_cluster_match   INTEGER,         -- 0/1 boolean
    cluster_id               INTEGER          -- DBSCAN label; -1 = noise/outlier
);

-- baselines: per-day text summary that gets embedded (companion to vec_baselines).
CREATE TABLE IF NOT EXISTS baselines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    day         TEXT NOT NULL,               -- YYYY-MM-DD the summary represents
    signal      TEXT,                        -- optional per-signal summary; NULL = whole-day
    summary     TEXT NOT NULL,               -- textual serialisation embedded by nomic-embed-text
    created_at  TEXT NOT NULL
);

-- voice_checkins: voice feature rows (writer ownership TBD with Eleoner — see openQ).
CREATE TABLE IF NOT EXISTS voice_checkins (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp               TEXT NOT NULL,
    speech_rate_wpm         INTEGER,
    clarity_score           REAL,
    sentiment               TEXT,
    confusion_markers       INTEGER,         -- 0/1
    response_latency_s      REAL,
    duration_s              INTEGER,
    baseline_deviation_cosine REAL           -- present on distress events
);

-- alerts: co-owned (Tanmay wander/distress rows, Elia intervention dispatch). Agree columns in Phase 1.
CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type  TEXT NOT NULL,               -- wandering | voice_distress | intervention
    signal      TEXT,                        -- related signal (nullable)
    payload     TEXT NOT NULL DEFAULT '{}',  -- JSON detail
    dispatched  INTEGER NOT NULL DEFAULT 0,  -- WeChat sent? (Elia)
    created_at  TEXT NOT NULL
);

-- vec_baselines: sqlite-vec virtual table. 768 dims = nomic-embed-text. Created only if extension loads.
CREATE VIRTUAL TABLE IF NOT EXISTS vec_baselines USING vec0 (
    baseline_id INTEGER PRIMARY KEY,         -- FK -> baselines.id
    embedding   FLOAT[768]
);
```

**Dedup strategy (you must define — no spec exists):** the demo replays templated events with **freshly regenerated timestamps each run** (`main.py:362` sets `evt["timestamp"]=_ts()`). A content-only key would wrongly drop legit replays; a timestamp-only key never dedups true duplicates. **Sharp edge:** `trend_7day` fires **multiple `cosine_update` events with identical payloads** within the same second (e.g. `0.04` appears at `main.py:274` and `main.py:297`). A naive `sha1(type|source|room|timestamp|payload)` could collide those two same-second `0.04` events on a 1-second-resolution timestamp and **silently drop the second**, corrupting `routine` behaviour.
- **Decision:** include **sub-second precision AND a monotonic per-process `seq` counter** so legitimate same-payload replays never collide:
  `dedup_key = sha1(f"{event_type}|{source}|{room}|{timestamp_microseconds}|{json.dumps(payload,sort_keys=True)}|{seq}")`.
  Because `seq` is strictly increasing per process, this **only ever collides on a literal re-POST of the exact same in-memory event object** (true double-POST), never on distinct replay events — i.e. dedup is **scoped to true double-POSTs only**, which is the intent. Persist `seq` in the `events.seq` column for ordering/debug. On `INSERT OR IGNORE`, a `UNIQUE` collision = duplicate, skip silently and continue processing (don't raise — raising triggers fallback).
  > If `seq` feels like over-engineering for the hackathon, the equivalent minimal version is to **scope dedup strictly to true double-POSTs** by keying on object identity within a request and accepting all replays — but the `seq`+microsecond key is safer and costs nothing.

---

## 5. File-by-File Implementation Plan

### `backend/config.py` (single source of truth — build first)
```python
COLD_START_DAYS          = 7      # PRD §5.2: ONE constant, ONE place. No cosine before day 7.
BASELINE_WINDOW_DAYS     = 14     # rolling cosine comparison window
ROUTINE_COSINE_RED       = 0.25   # routine red when cosine_distance > 0.25
ROUTINE_COSINE_AMBER     = 0.15   # <0.15 green, [0.15,0.25) amber, >=0.25 red
LOCATION_DENSITY_AMBER   = 0.15   # density>0.15 -> amber (else red) when cluster_match False
WOKE_WINDOW_START_H      = 5      # bedroom morning window [5,11]
WOKE_WINDOW_END_H        = 11
ATE_DWELL_GREEN_S        = 300    # kitchen dwell >=300 green, 0<dwell<300 amber
AMBER_TIMEOUT_PASSIVE_H  = 4      # mmwave_*, baseline
AMBER_TIMEOUT_ACTIVE_H   = 2      # voice_system, pill_dispenser, gps_tracker
WANDER_MIN_MINUTES       = 30     # stationary/unknown >30min is one wandering condition
EMBED_DIM                = 768    # nomic-embed-text
EMBED_MODEL              = "nomic-embed-text"
HOME_LAT, HOME_LNG       = 22.5431, 114.0579   # Shenzhen home cluster
ACTIVE_SOURCES           = {"voice_system", "pill_dispenser", "gps_tracker"}
```

### `backend/edge_processor.py` — normalise ALL sources
**Purpose:** the normalise step before persistence. Converts every wire event into a canonical record and computes `dedup_key`.
**Public:** `def normalize(event: dict) -> dict` → returns `{event_type, source, room|None, timestamp, confidence, payload, dedup_key, seq}`.
**Logic:** validate at boundary (event_type non-empty, source known); use `event.get("room")` (**room key is ABSENT, not null**, for pill/voice/gps/baseline — `radar_simulator.py:57-70`); default `timestamp` to `_ts()`, `confidence` to `1.0`, `payload` to `{}`; assign monotonic `seq`; compute `dedup_key` (§4). Must handle all 12 event types and 7 sources: `mmwave_ld2410` (presence_detected/ended/multi), `mmwave_mr60bha2` (breathing_update), `mmwave_mr60fda1` (fall_detected), `pill_dispenser` (dispenser_opened/missed), `voice_system` (voice_checkin_completed/distress), `gps_tracker` (location_update/wandering_detected), `baseline` (cosine_update). Unknown event_type → return normalised record anyway (ingestion returns `[]` for it).
**Connects to:** called first by `ingestion.process_event`.

### `backend/signals.py` — the 8-signal state machine (ACCURACY-CRITICAL)
**Purpose:** deterministic green/amber/red/unknown decisions (the LLM never decides state). This module determines the §7 32-cell accuracy score.
**Public:**
```python
def update_signal_state(event: dict, *, now: datetime | None = None) -> list[dict]:
    """Return a list of signal_update SSE envelopes for this event (often 0 or 1)."""
def reset() -> None:  # clear in-memory accumulators between scenarios
def current_states() -> dict[str, dict]:  # for replay.py
```
**Constants:** import everything from `config.py`. Reference `COLD_START_DAYS` here and **nowhere else**.
**Internal logic per signal** (replicate the §3 threshold table EXACTLY — use the same inequalities: `5 <= hour <= 11`, `dwell >= 300`, `> 0`, `< 0.15`, `< 0.25`, `> 0.15`):
- `woke_up` ← `presence_detected` room=bedroom, hour in `[5,11]` → green.
- `ate` ← `presence_detected` room=kitchen: `dwell_s>=300`→green, `0<dwell_s<300`→amber.
- `took_meds` ← `dispenser_opened`→green, `dispenser_missed`→red. **AMBER is NET-NEW (no oracle):** the fallback has no amber path; amber-by-"no event by 11:00 / window exceeded >2h" comes only from the amber-timeout machine below. This is the one §7 cell (B-column) you build from scratch.
- `rested_well` ← `breathing_update`: `in_baseline`→green else amber.
- `helper_present` ← `multi_presence_detected`→green.
- `voice_checkin` ← `voice_checkin_completed` (confusion→red else green), `voice_distress_detected`→red (cosine = `baseline_deviation_cosine`).
- `location` ← `location_update`/`wandering_detected` (delegated to `location.py`'s computed fields: `cluster_match`→green; else `density>0.15`→amber; else red; wandering→red).
- `routine` ← `cosine_update`: `<0.15` green, `<0.25` amber, `>=0.25` red. **Before day `COLD_START_DAYS`: state=`unknown`, reason="insufficient baseline history", no cosine comparison.**

**Amber-timeout state machine:** track `amber_since` per signal (in-memory dict + `signals` table). When a signal is amber and `(now - amber_since) > timeout` (4h passive / 2h active by `source`), escalate per signal semantics or re-emit. This machine **also produces the `took_meds` amber cell** (no `dispenser_opened` by 11:00 → amber). Persist `amber_since` so it survives. No existing test exercises this directly; `replay.py` will.
**Every emitted `signal_update`** MUST carry all 5 keys (incl. `cosine_distance`, even `None`, and `updated_at`). **Connects to:** called by `ingestion.process_event`; reads `location.py` outputs for the location signal.

### `backend/location.py` — GPS / DBSCAN / wandering (no geofencing)
**Purpose:** compute `trajectory_density_score`, `baseline_cluster_match`, detect wandering statistically.
**Public:**
```python
def process_location(event: dict) -> list[dict]:  # returns location_update SSE + drives location signal
def is_wandering(density: float, cluster_match: bool, minutes_outside: int) -> bool
def fit_baseline_clusters(points: list[tuple[float,float]]) -> "DBSCAN"  # pre-baked OK for demo
```
**Logic:** persist each point to `locations`. **Pass-through simulator-supplied values** (`trajectory_density_score`, `baseline_cluster_match`) when present (the simulator pre-bakes them — `explained_someshit.md:34`); compute via DBSCAN only when absent. **Wandering = ALL THREE:** `baseline_cluster_match=False` **AND** `trajectory_density_score < threshold` (normal ~0.91 vs wander 0.09) **AND** `minutes_outside_baseline_footprint > 30`. DBSCAN on lat/lng (`scikit-learn`) — PRD §9/§11.1 says "pre-baked for demo," so seeding clusters from `gps_normal.json` home cluster is acceptable; `eps≈0.0015` (~150m), `min_samples=5`. `cluster_id=-1` = outlier. **`location_update` SSE = fallback-identical** (`{**payload, "updated_at"}`, lat/lng **kept** — §3): store lat/lng in `locations` AND forward them in the envelope. **Connects to:** called by `ingestion`; supplies the `location` signal state to `signals.py`.

### `backend/baseline.py` — embeddings + cosine (hybrid: pass-through default, live stretch)
**Purpose:** nomic-embed-text embeddings → sqlite-vec cosine vs 14-day window → drives `routine`. Backs `agent.get_recent_events`.
**Public:**
```python
def compute_cosine(event: dict) -> float | None:   # pass-through payload.cosine_distance, else embed+query
def embed_day(summary: str) -> list[float]         # nomic-embed-text via Ollama (768-dim)
def store_baseline(day: str, summary: str) -> None
def query_recent_events(hours: float, event_type: str | None = None) -> list[dict]  # backs agent tool
```
**Logic:** **For the demo, pass `cosine_update.payload.cosine_distance` straight through** (the simulator emits the pre-baked ladder `0.04→0.05→0.08→0.12→0.17→0.26→0.38`). Live computation (embed today's serialised event stream, cosine vs trailing 14-day vectors in `vec_baselines`) is a **stretch** — and **must never block `process_event` on the demo path** (Ollama latency vs <5s budget, §9). Respect `COLD_START_DAYS`: no cosine before day 7. `reasoning_update.baseline_window_days=14` (agent owns the event; you supply `cosine_distance` only).
**Connects to:** `compute_cosine` feeds `signals.py` routine; `query_recent_events` backs `agent.py:243-250`.

### `backend/ingestion.py` — the load-bearing orchestrator
**Purpose:** the single public entry `main.py` imports. Normalise → persist → derive signals → return SSE.
**Public:**
```python
def process_event(event: dict) -> list[dict]:   # SYNC. The contract.
def reset_state() -> None:                       # reset hook for Elia
```
**Logic (order matters):**
1. **Fall fast-path FIRST** — `if event_type == "fall_detected"`: persist, return `[fall_detected SSE, presence_update(room=bathroom, occupied=True, fall=True)]`, **no signal_update, no embed, no Ollama.** (Flag fall_active wiring — §9.)
2. `rec = edge_processor.normalize(event)`; `db.insert_event(rec)` with `INSERT OR IGNORE` (dedup); if duplicate → return `[]`.
3. `location_update`/`wandering_detected` → delegate to `location.py`, collect SSE (`location_update` envelope kept fallback-identical, lat/lng included).
4. `cosine_update` → `baseline.compute_cosine` → feed to `signals.update_signal_state`.
5. All others → `signals.update_signal_state(rec)` for the signal_update(s).
6. For `presence_detected`/`presence_ended` also emit the `presence_update` SSE.
7. Return the combined list of SSE envelopes. **Never raise on valid input.**
**Connects to:** imports `edge_processor`, `signals`, `location`, `baseline`, `db`. **Lazy DB init + lazy sqlite-vec load** (open connection and load the extension on first call, not at module import — §4 landmine, §9 risk #1).

### `backend/seed.py` — 30-day baseline preloader (NEW — not in PRD §11; must be created + coordinated)
**Purpose:** there is **no documented seeding mechanism** in the PRD §11 repo structure (PRD lists only `ingestion/edge_processor/baseline/signals/location` for Tanmay; `voice_checkin.py` for Eleoner). Without a preload, `routine` sits at `unknown` through the demo and the location baseline clusters are empty. This module is a **plan invention** that must be built and its invocation agreed with Elia (who owns demo startup).
**Public:** `def seed_baselines(db_conn) -> None` — load `gps_normal.json` into `locations` + fit/persist baseline clusters; insert 14+ days of baseline summary rows (and, if live embeddings are enabled, their vectors) so `COLD_START_DAYS` is satisfied at demo time.
**Entry point (coordinate):** run once at backend startup (Elia's lifespan/startup hook) **or** as a standalone `python -m backend.seed`. Decide owner + trigger in Phase 1 — "seed before demo" currently has **no owner**.
**Connects to:** writes via `db.py`; consumes `data/synthetic/gps_normal.json`.

---

## 6. Synthetic Data: `gps_normal.json` & `gps_wander.json`

Follow the verified existing idiom. `_meta` keys per Elia's convention. Coords: home cluster `lat 22.5431, lng 114.0579`; wander point `lat 22.5512, lng 114.0701`.

### `data/synthetic/gps_normal.json` — flat idiom (like `normal_morning.json`)
30 representative normal `location_update` points clustered tightly around home (jitter ±0.001 ≈ ±100m), `distance_from_home_m` 500-650, `trajectory_density_score` 0.85-0.95, `baseline_cluster_match: true`. This is the corpus the wander day must deviate from.
```json
{
  "_meta": {
    "description": "30-day normal GPS routes — feeds location baseline clusters (DBSCAN).",
    "date": "2026-05-07", "owner": "Tanmay",
    "speed": "one representative point per day, clustered around home"
  },
  "events": [
    {"event_type": "location_update", "source": "gps_tracker",
     "timestamp": "2026-05-07T11:15:00Z", "confidence": 0.97,
     "payload": {"lat": 22.5433, "lng": 114.0581, "distance_from_home_m": 610,
                 "trajectory_density_score": 0.93, "baseline_cluster_match": true}},
    {"event_type": "location_update", "source": "gps_tracker",
     "timestamp": "2026-05-08T11:10:00Z", "confidence": 0.97,
     "payload": {"lat": 22.5429, "lng": 114.0577, "distance_from_home_m": 580,
                 "trajectory_density_score": 0.91, "baseline_cluster_match": true}}
    /* … 28 more days, lat/lng jittered ±0.001 around home, density 0.85–0.95 … */
  ]
}
```

### `data/synthetic/gps_wander.json` — nested per-day idiom (like `trend_7day.json`), Day-7 drift
A progression drifting outward — distance `610 → 890 → 1350 → 1800`m, density `0.93 → 0.61 → 0.28 → 0.09`, `cluster_match true → true → false → false` — starting from the normal home density (~0.93, mirroring `gps_normal.json`) and culminating in a `wandering_detected` event matching `trend_7day.json` day-7 values. *(Note: the home/start density ~0.91–0.93 is the gps_normal baseline; the wander file's own points begin at 0.61 and fall to 0.09 — the JSON below is the source of truth for the exact values.)*
```json
{
  "_meta": {
    "description": "Day-7 wandering trajectory — drives Scenario C. Outward drift then wandering_detected.",
    "owner": "Tanmay",
    "note": "Dates are relative offsets; ingestion may rebase. Mirrors trend_7day.json day-7 GPS values."
  },
  "days": [
    {"day": 7, "label": "Wandering", "cosine_distance": 0.38, "events": [
      {"event_type": "location_update", "source": "gps_tracker",
       "timestamp": "2026-05-13T14:05:00Z", "confidence": 0.97,
       "payload": {"lat": 22.5448, "lng": 114.0598, "distance_from_home_m": 890,
                   "trajectory_density_score": 0.61, "baseline_cluster_match": true}},
      {"event_type": "location_update", "source": "gps_tracker",
       "timestamp": "2026-05-13T14:25:00Z", "confidence": 0.97,
       "payload": {"lat": 22.5489, "lng": 114.0655, "distance_from_home_m": 1350,
                   "trajectory_density_score": 0.28, "baseline_cluster_match": false}},
      {"event_type": "wandering_detected", "source": "gps_tracker",
       "timestamp": "2026-05-13T14:39:00Z", "confidence": 0.96,
       "payload": {"lat": 22.5512, "lng": 114.0701, "distance_from_home_m": 1800,
                   "trajectory_density_score": 0.09, "baseline_cluster_match": false,
                   "minutes_outside_baseline_footprint": 34}}
    ]}
  ]
}
```

---

## 7. The 32-Classification Accuracy Target (PRD §7)

`signals.py` must reproduce this table. Scenarios: **A**=Normal Morning, **B**=7-Day Trend, **C**=Wandering, **D**=Voice Distress. Pass = **≥26/32 (80%)**. Fall is scored separately (binary: fires <10s).

| Signal | A (Normal) | B (7-Day Trend) | C (Wandering) | D (Voice Distress) |
|---|---|---|---|---|
| **woke_up** | 🟢 green | 🟡 amber | 🟢 green | 🟡 amber |
| **ate** | 🟢 green | 🟡 amber | 🟢 green | 🟢 green |
| **took_meds** | 🟢 green | 🟡 amber | 🟢 green | 🟢 green |
| **rested_well** | 🟢 green | 🟡 amber | 🟢 green | 🟡 amber |
| **helper_present** | 🟢 green | 🟢 green | 🟢 green | 🟢 green |
| **voice_checkin** | 🟢 green | 🔴 red | 🟢 green | 🔴 red |
| **location** | 🟢 green | 🔴 red | 🔴 red | 🟢 green |
| **routine** | 🟢 green | 🔴 red | 🔴 red | 🔴 red |

**Per-signal input conditions to hit each cell:**
- **woke_up:** bedroom presence in `[5,11]`→green (A,C). In B/D the morning bedroom event is missing/late → amber. *Note B & D amber-by-absence; the scenario feed must omit/delay the bedroom presence, and the amber must come from the §5 amber-timeout machine (no green event arrives).*
- **ate:** kitchen `dwell_s>=300`→green (A,C,D). B → `0<dwell<300` amber (short meal).
- **took_meds:** `dispenser_opened`→green (A,C,D). **B → amber.** ⚠️ The fallback has **no took_meds amber path** (§3 oracle gap); this cell is produced solely by the §5 amber-timeout machine ("no `dispenser_opened` by 11:00"). Build + verify it explicitly in `replay.py`; there is no oracle to mirror.
- **rested_well:** `breathing_update in_baseline=True`→green (A,C). B/D → `in_baseline=False`→amber.
- **helper_present:** `multi_presence_detected`→green in **all four** (helper always shows).
- **voice_checkin:** clean check-in→green (A,C). B → distress/confusion red; D → `voice_distress_detected` red.
- **location:** `cluster_match=True`→green (A,B-early,D). C → wandering red. **B day-7 → red** (the wander event lives in the trend too).
- **routine:** cosine `<0.15`→green (A). B/C/D → cosine `>=0.25`→red (0.38 in trend).

**Critical cross-signal nuances (don't over-propagate):**
- **Scenario D (Voice Distress):** ambers `woke_up` + `rested_well` but keeps `ate`/`took_meds` **green**. → Voice distress must **not** amber the meal/med signals. The D ambers come from the scenario's own missing-bedroom/abnormal-breathing events, NOT from voice.
- **Scenario C (Wandering):** **only** `location` + `routine` go red, everything else green. → Wandering must not propagate to other signals.
- A naive "voice distress reds everything" or "one red ambers all" heuristic **fails the gate**. Keep signals independent; let the scenario event streams drive the ambers.

`replay.py` feeds each scenario's events one at a time through `process_event`, snapshots `signals.current_states()`, and asserts against this table. **Pay special attention to the amber-by-absence cells (B/D woke_up, B took_meds, B ate, B/D rested_well)** — several have no fallback oracle and depend entirely on new logic.

---

## 8. Phase-by-Phase Task Breakdown (PRD §9/§11)

**Hour-8 = HARD CHECKPOINT** (preserved exactly per PRD §9): the full 2-min demo must run end-to-end. `signals.py`, `baseline.py`, `location.py` all functional by Hour 8. Broken at Hour 8 → 10h to fix; broken at Hour 16 → cut. **Phase windows below match PRD §9 (lines 536/552/568/584): 0-3 / 3-8 / 8-13 / 13-18, 18h total.**

### Phase 1 (Hours 0-3) — Foundation. **CRITICAL PATH.**
- [ ] `config.py` — all constants.
- [ ] `db.py` — `init_db()`, defensive sqlite-vec load (both `enable_load_extension` + `sqlite_vec.load` in one try/except; numpy fallback), all 6 tables + `vec_baselines`. Honour `DB_PATH`.
- [ ] **Coordinate the `alerts` table columns with Elia + Eleoner** (3 writers).
- [ ] `edge_processor.normalize` + `dedup_key` (microsecond + `seq`).
- [ ] **Decide signals.update_signal_state signature with Elia; agree reset hook + fall_active wiring (§9) + seed.py owner/trigger.**
- [ ] Stub `signals.update_signal_state` + `ingestion.process_event` so **both import cleanly** → flips `HAS_TANMAY=True`. *Unblocks: nothing of yours runs until both import.*

### Phase 2 (Hours 3-8) — Signals + Location + Baseline live. **→ Hour-8 checkpoint.**
- [ ] `signals.py` full 8-signal machine matching §3 thresholds + cold-start + amber timeouts (**incl. the net-new took_meds amber**).
- [ ] `location.py` DBSCAN (pre-baked) + wandering + `location_update`(fallback-identical)/`wandering_detected` SSE.
- [ ] `baseline.py` cosine **pass-through** + `query_recent_events`.
- [ ] `ingestion.process_event` wiring (fall fast-path first) returning correct SSE.
- [ ] `gps_normal.json` + `gps_wander.json` + `seed.py` preload.
- [ ] *Unblocks Mar (LocationMap trace) + Elia (agent `get_recent_events`).*
- [ ] **Run `python -m pytest backend/tests/` from `backend/` — all existing tests still green with `HAS_TANMAY=True`.**

### Phase 3 (Hours 8-13) — Integration hardening.
- [ ] Wire `ingestion.reset_state()` into `_reset_state` (with Elia).
- [ ] Wire `fall_active` on the live path (with Elia) — runtime/demo fix, not a test fix.
- [ ] Wire `seed.py` into backend startup (with Elia).
- [ ] Write `alerts` rows for wandering + distress.
- [ ] Equivalence tests: `from ingestion import process_event` mirrors fallback per event type.

### Phase 4 (Hours 13-18) — Accuracy gate + polish.
- [ ] `tests/replay.py` — feed normal/trend_7day/wander/voice scenarios through `process_event`, assert ≥26/32 vs §7.
- [ ] Tune any failing cells (esp. D ambers, C isolation, B took_meds amber).
- [ ] (Stretch) live nomic-embed-text cosine if budget allows.
- [ ] Full 2-min demo dry-run with Wi-Fi off (honesty check).

---

## 9. Risks & Gotchas

1. **`HAS_TANMAY` all-or-nothing import gate** — *either* module failing to import (incl. import-time DB open / sqlite-vec load) disables **everything**. **Open DB + load sqlite-vec lazily inside `process_event`, never at module top.**
2. **stdlib sqlite3 may lack loadable-extension support** — on many distros (default Ubuntu `python3`) `conn.enable_load_extension(True)` raises `AttributeError`/`OperationalError` **before** `sqlite_vec.load()` runs. Wrap **both calls in the same `try/except`** (catch `AttributeError` + `sqlite3.OperationalError`), keep it lazy, and fall back to numpy cosine. This is the most likely real cause of a silent full-layer fallback. (§4 landmine.)
3. **Silent fallback** — `main.py:381-383` swallows all exceptions; a buggy module looks like it works (fallback runs). **Watch logs for "Tanmay ingest error"; self-test via `replay.py` + equivalence tests.** The existing suite can pass against the fallback while your code is broken.
4. **SYNC contract** — `process_event` is run via `asyncio.to_thread`. `async def` → returns a coroutine → iteration breaks → silent fallback. **Plain `def`.**
5. **`fall_active` LIVE/DEMO GAP (runtime only — NOT a test failure)** — set only in the fallback (`main.py:216`). On the `HAS_TANMAY` path it's never set, so during a live `POST /scenario/fall` → `_ingest_and_broadcast` demo, `/health.fall_active` stays `false`. The fall test (`test_ingest.py:199-211`) calls `_process_event_inplace` **directly** and still passes regardless of `HAS_TANMAY`, so **no test breaks** — but the live fall demo is wrong. **Fix: ask Elia to patch `main.py` to set `fall_active=True` when a returned event has `event=="fall_detected"`.**
6. **`location_update` SSE divergence (resolved)** — the fallback keeps `lat`/`lng`; PRD §5.6's frontend form drops them. **No test enforces either.** We **mirror the fallback** (lat/lng kept) to honor the byte-identical mandate and Mar's contract-of-record; do not silently adopt §5.6 form, as that would diverge from the oracle without aligning the fallback. If §5.6 form is wanted, Elia changes the fallback in both places.
7. **Reset bleed** — `_reset_state` doesn't touch your accumulators. **Expose `reset_state()`, get Elia to call it.** Threatens Act-2 trend correctness.
8. **Byte-matching SSE strings** — signal names, states, rooms, and asserted payload key-sets must match `mock_server.py` / the fallback exactly (Mar's contract-of-record). The `fall` bool in `presence_update` and `cosine_distance`/`reason` in `signal_update` are **test-required but under-specified in PRD §5.6** — build from the tests, not the PRD prose.
9. **took_meds amber has no oracle** — the fallback only does green/red for dispenser events; the B-column amber cell exists only via the new amber-timeout machine. There is **no fallback behaviour to replicate** for this cell, so verify it directly in `replay.py`. (§3, §7.)
10. **Dedup edge case — same-second identical replays** — `trend_7day` fires duplicate-payload `cosine_update`s in the same second (`0.04` at `main.py:274,297`). A 1-second-resolution dedup key would drop the second and corrupt `routine`. **Use microsecond precision + monotonic `seq`** so only literal double-POSTs collide (§4).
11. **sqlite-vec cross-OS load failure** (PRD §13) — pin version, `try/except` the extension load, fall back to numpy cosine so the demo never hard-crashes. (Subsumes #2's specific failure mode.)
12. **Ollama embedding latency vs <5s budget** (PRD §12) — **never block `process_event` on a live embed**. Pass-through cosine is the demo path; live embedding is a non-blocking stretch.
13. **Hybrid Inference Strategy (PRD:154)** — **LIVE/must-work:** rule-based signal states + sqlite-vec cosine math. **CACHED:** only the natural-language reasoning narratives (agent's `_CACHE`). Faking cosine math violates the honesty claim (Wi-Fi-off verification). Don't fake the math; do cache the prose (Elia owns that).
14. **Cold-start vs demo + no seeding owner** — the 30-day baseline must be **pre-loaded**, but there is **no documented seeder** in PRD §11. `seed.py` (§5) is a **new module you create**; its startup trigger has **no owner yet**. Without it, `routine` sits at `unknown` and location clusters are empty during the demo. **Build `seed.py` and agree the trigger with Elia before the demo.**
15. **Don't break the existing tests** — run `python -m pytest backend/tests/` from `backend/` after every module lands. The regression sync test (`test_ingest.py:496-533`) is the canary.
16. **8 signals authoritative** — PRD's 8-signal/32-cell wins over `HONESTY.md`'s stale 5-signal/15-cell (`explained_someshit.md:39-45`). Build to 8.

---

## 10. First Three Concrete Actions

**1. Confirm tests pass clean today and read the oracle + agent stub.** Run from `backend/` (there is no repo-root `requirements.txt`; `pytest` is in `backend/requirements-dev.txt`):
```bash
cd /home/tanmay/Desktop/rapid_agent_devpost/Guardian/backend && python -m pytest tests/ -q
```
(Establish the green baseline you must not break. `_process_event_inplace` at `main.py:125-233` is your behavioral oracle — but note it has no `took_meds` amber path.)

**2. Create `backend/config.py` then `backend/db.py`** with the constants (§5) and the full DDL (§4) including the defensive sqlite-vec load (both calls in one try/except, lazy):
```python
# db.py skeleton
import os, sqlite3
DB_PATH = os.getenv("DB_PATH", "./guardian.db")
def _load_vec(conn):
    try:
        conn.enable_load_extension(True)      # may raise AttributeError/OperationalError on stripped builds
        import sqlite_vec; sqlite_vec.load(conn)
        return True
    except (AttributeError, sqlite3.OperationalError, Exception):  # numpy cosine fallback — demo must not crash
        return False
def init_db():
    conn = sqlite3.connect(DB_PATH); conn.executescript(SCHEMA_SQL); _load_vec(conn); return conn
# NOTE: call init_db()/_load_vec lazily from inside process_event, NOT at module import.
```

**3. Land the import-gate stubs so `HAS_TANMAY` flips True immediately**, then iterate:
```python
# backend/signals.py
def update_signal_state(event, *, now=None): return []   # import-gate stub; fill in Phase 2
# backend/ingestion.py
def process_event(event: dict) -> list[dict]:            # SYNC — the contract
    return []                                             # returns [] -> harness uses fallback until filled
def reset_state() -> None: ...
```
Verify the gate: `cd backend && python -c "import main; print('HAS_TANMAY=', main.HAS_TANMAY)"` → must print `True`. Then re-run the tests to confirm still green, and begin filling `signals.py` against the §3 table and §7 accuracy target.

---

**Coordination asks for Elia (resolve in Phase 1):** (a) `signals.update_signal_state` call-site decision (fold into `process_event` — recommended); (b) wire `ingestion.reset_state()` into `_reset_state`; (c) set `fall_active` from returned `fall_detected` events on the `HAS_TANMAY` path (runtime/demo fix); (d) `alerts` table columns (3 writers); (e) `seed.py` trigger/owner at backend startup. **For Eleoner:** who writes `voice_checkins` rows (ingestion vs her `voice_checkin.py`) to avoid double-writes.

---

## Open Questions for the Team

These are genuinely ambiguous and should be confirmed before/early in implementation — don't guess:

1. **`/ingest` seam exactness (Elia):** §2 quotes `main.py:48-55` / `377-405` from analysis. Confirm the live line numbers and that `process_event` is invoked via `asyncio.to_thread` with the `signal_update` re-sync loop intact — the entire plan hinges on this seam being unchanged.
2. **Who owns the signal store — `signals.py` or `main.py`? (Elia):** `main.py` re-derives `signal_state` from returned `signal_update` payloads and never calls `update_signal_state`. The plan assumes `process_event` drives the state machine internally and `main.py` only mirrors badges. Confirm `main.py` will **not** also try to own/compute signal state (double-ownership would desync).
3. **`location_update` envelope shape (Elia + Mar):** we chose fallback-identical (lat/lng kept) because no test pins it. Confirm Mar's LocationMap consumes lat/lng from `location_update` (vs `distance_from_home_m` only). If Mar wants the PRD §5.6 lat/lng-dropped form, Elia must change the fallback in both places to keep the oracle aligned.
4. **`fall_active` live-path wiring (Elia):** OK to patch `main.py` so `_ingest_and_broadcast` sets `fall_active=True` on a returned `fall_detected`? This is the only way the live fall demo reflects the flag.
5. **`reset_state()` hook (Elia):** confirm Elia will call `ingestion.reset_state()` inside `_reset_state` so accumulators/DB don't bleed across `/scenario/{name}` switches.
6. **`seed.py` owner + trigger (Elia):** there is no documented seeder. Who invokes the 30-day preload, and where (startup lifespan hook vs manual `python -m backend.seed`) — and is it run before every demo?
7. **`voice_checkins` writer ownership (Eleoner):** does `ingestion`/`edge_processor` persist voice rows, or does Eleoner's `voice_checkin.py`? Avoid double-writes / schema drift.
8. **`alerts` table column contract (Elia + Eleoner):** three writers (Tanmay wander/distress, Elia intervention dispatch). Lock columns + `dispatched` semantics in Phase 1.
9. **`took_meds` amber semantics (team):** PRD §5.1 says amber = "no event by 11:00"; the fallback can't produce it. Confirm the exact wall-clock trigger (fixed 11:00 vs 2h-after-window) the scenarios expect, since this cell has no oracle and directly affects the §7 gate.
10. **Active vs passive sensor split for amber timeouts (team):** the 2h/4h classification (`voice_system`/`pill_dispenser`/`gps_tracker` = active) is a plan assumption, not spec'd. Confirm before it silently skews amber escalation timing.
