<!-- Generated: 2026-06-07 | Files scanned: 8 | Token estimate: ~850 -->

# Data Layer

Single-file SQLite + sqlite-vec on the family device. No cloud DB.
`DB_PATH` env: `./guardian.db` (local) / `/app/db/guardian.db` (Docker volume `guardian_db`).
Connection: lazy singleton in `db.get_conn()`, `journal_mode=WAL`, `foreign_keys=ON`.

## SQLite schema (`backend/db.py`, 159 ln)

```sql
events         id PK, event_type, source, room, timestamp, confidence REAL,
               payload JSON, dedup_key TEXT UNIQUE, seq INT, ingested_at
               INDEX: (event_type, timestamp), (ingested_at)
               DEDUP: sha1(type|source|room|timestamp|payload_json|seq|uuid4)

signals        signal TEXT PK, state, reason, cosine_distance REAL,
               updated_at, amber_since

locations      id PK, timestamp, lat REAL, lng REAL, distance_from_home_m INT,
               trajectory_density_score REAL, baseline_cluster_match INT, cluster_id INT

baselines      id PK, day TEXT, signal TEXT, summary TEXT, created_at
               UNIQUE INDEX: (day, COALESCE(signal, ''))

voice_checkins id PK, timestamp, speech_rate_wpm INT, clarity_score REAL, sentiment,
               confusion_markers INT, response_latency_s REAL, duration_s INT,
               baseline_deviation_cosine REAL

alerts         id PK, alert_type TEXT, signal, payload JSON, dispatched INT, created_at
               (alert_type: wandering | voice_distress | intervention)

vec_baselines  VIRTUAL TABLE USING vec0(baseline_id INT PK, embedding FLOAT[768])
               — created only if sqlite-vec extension loads (VEC_AVAILABLE flag)
```

sqlite-vec load: both `enable_load_extension()` and `sqlite_vec.load()` wrapped in one
`try/except(AttributeError, OperationalError)` — numpy cosine fallback if extension unavailable.

## Constants (`backend/config.py`, 53 ln — single source of truth)

```
COLD_START_DAYS = 7              # no cosine comparison before day 7
BASELINE_WINDOW_DAYS = 14        # rolling cosine comparison window
ROUTINE_COSINE_AMBER = 0.15      # [0.15, 0.25) → amber
ROUTINE_COSINE_RED = 0.25        # ≥ 0.25 → red
LOCATION_DENSITY_AMBER = 0.15    # score > 0.15 → amber (else red) when cluster_match=False
WOKE_WINDOW_START_H = 5          # bedroom morning window [5, 11] UTC
WOKE_WINDOW_END_H = 11
ATE_DWELL_GREEN_S = 300          # kitchen dwell ≥300s → green
WANDER_MIN_MINUTES = 30
HOME_LAT, HOME_LNG = 22.5431, 114.0579   # Shenzhen home cluster
EMBED_DIM = 768  |  EMBED_MODEL = "nomic-embed-text"
CONNECTION_BASELINE_DAYS = 14    # connection window inference
CONNECTION_WINDOW_START_H = 10   # connection window_END_H = 20
CONNECTION_MIN_PRESENCE_FREQ = 3
```

## Wire event schema (into POST /ingest)

```json
{ "event_type": str, "source": str, "room": str|null,
  "timestamp": "ISO8601", "confidence": float, "payload": {} }
```

Sources: `mmwave_ld2410` `mmwave_mr60fda1` `mmwave_mr60bha2`
         `pill_dispenser` `voice_system` `gps_tracker` `baseline`

## 8 signals → event source mapping

```
woke_up        presence_detected(bedroom, morning window)
ate            presence_detected(kitchen, dwell_s thresholds)
took_meds      dispenser_opened → green / dispenser_missed → red
rested_well    breathing_update(in_baseline)
helper_present multi_presence_detected
voice_checkin  voice_checkin_completed / voice_distress_detected  [Eleoner pending]
location       location_update(cluster_match) / wandering_detected
routine        cosine_update (simulator pre-baked; baseline.py for live Ollama path)
```

## Synthetic data files

```
data/synthetic/normal_morning.json   {_meta, events[17]}   one representative day (Elia)
data/synthetic/trend_7day.json       {_meta, days[7]}      cosine 0.04→0.38 crisis (Elia)
data/synthetic/gps_normal.json       30 location_update events, home cluster (Tanmay) ✅
data/synthetic/gps_wander.json       {days[3]}: drift day5→6→7, wandering_detected (Tanmay) ✅
```

Home cluster: `lat 22.5431 ±0.001, lng 114.0579 ±0.001`. Wander point: `22.5512, 114.0701`, 1800m, density 0.09.

## Seed (`backend/seed.py`, 241 ln)

```
seed_all() → seed_gps_baseline() + seed_signal_summaries()
```
- `seed_gps_baseline()` — loads `gps_normal.json` into `locations` table (cluster_id=0)
- `seed_signal_summaries()` — 30 synthetic daily summaries into `baselines` (INSERT OR IGNORE)
Called from main.py lifespan hook at startup. Safe to re-run.

## connection_prefs.json (sibling to guardian.db)

```json
{ "free_windows": [{"start": 15, "end": 17}, {"start": 20, "end": 21}],
  "timezone": "Asia/Hong_Kong" }
```
Read by `connection.load_prefs()`. Defaults used if file absent.
