<!-- Generated: 2026-06-07 | Files scanned: 10 | Token estimate: ~900 -->

# Data Layer

Single-file SQLite + sqlite-vec on the family device. No cloud DB.
`DB_PATH` env: `./guardian.db` (local) / `/app/db/guardian.db` (Docker volume `guardian_db`).

## SQLite schema (`backend/db.py`)

```sql
events         id PK, event_type, source, room, timestamp, confidence REAL,
               payload JSON, dedup_key TEXT UNIQUE, seq INT, ingested_at

signals        signal TEXT PK, state, reason, cosine_distance REAL,
               updated_at, amber_since

locations      id PK, timestamp, lat, lng, distance_from_home_m,
               trajectory_density_score, baseline_cluster_match, cluster_id

baselines      id PK, day, signal, summary, created_at

voice_checkins id PK, timestamp, speech_rate_wpm, clarity_score, sentiment,
               confusion_markers, response_latency_s, duration_s,
               baseline_deviation_cosine REAL

alerts         id PK, alert_type, signal, payload JSON, dispatched, created_at

vec_baselines  VIRTUAL TABLE USING vec0(baseline_id INT PK, embedding FLOAT[768])
```

## Voice constants (`config.py`)

```
VOICE_WEIGHT_CLARITY=0.30  VOICE_WEIGHT_LATENCY=0.30  VOICE_WEIGHT_SPEECH_RATE=0.20
VOICE_WEIGHT_CONFUSION=0.20  VOICE_LATENCY_ABSOLUTE_RED_S=3.0
VOICE_BASELINE_MIN_SAMPLES=5  VOICE_CONFUSION_FLOOR=0.85
COLD_START_DAYS=7  BASELINE_WINDOW_DAYS=14
```

## Synthetic data files

```
data/synthetic/normal_morning.json   {_meta, events[17]}   one representative day
data/synthetic/trend_7day.json       {_meta, days[7]}      cosine 0.04→0.38 crisis
data/synthetic/gps_normal.json       30 location_update events, home cluster
data/synthetic/gps_wander.json       {days[3]} wandering_detected drift
data/synthetic/voice_normal.json     30 voice_checkin_completed (2026-05-07…06-05)
data/synthetic/voice_distress.json   3 escalating days; Day-7 pinned to trend_7day.json
```

## Seed (`backend/seed.py`)

```
seed_all() → seed_gps_baseline() + seed_signal_summaries() + seed_voice_baseline()
```
- `seed_voice_baseline()` — loads `voice_normal.json` into `voice_checkins` (INSERT OR IGNORE)
- `voice_distress.json` is reference-only (not seeded)

## Wire event schema (POST /ingest)

```json
{ "event_type": str, "source": str, "room": str|null,
  "timestamp": "ISO8601", "confidence": float, "payload": {} }
```

Voice §5.3 payload keys: `speech_rate_wpm`, `clarity_score`, `sentiment`,
`confusion_markers`, `response_latency_s`, `duration_s`, optional `baseline_deviation_cosine`.

## 8 signals → event source mapping

```
woke_up        presence_detected(bedroom, morning window)
ate            presence_detected(kitchen, dwell_s thresholds)
took_meds      dispenser_opened / dispenser_missed
rested_well    breathing_update(in_baseline)
helper_present multi_presence_detected
voice_checkin  voice_checkin_completed / voice_distress_detected  [voice_checkin.py enriches]
location       location_update / wandering_detected
routine        cosine_update
```
