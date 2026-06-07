"""voice_checkin.py — unit + integration tests (TDD-ordered)."""

import copy
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from voice_checkin import (
    VOICE_EVENT_TYPES,
    compute_voice_deviation,
    enrich_event,
    reset_voice_state,
)

VOICE_KEYS = {
    "speech_rate_wpm", "clarity_score", "sentiment",
    "confusion_markers", "response_latency_s", "duration_s",
}


@pytest.fixture
def voice_db(tmp_path, monkeypatch):
    db_path = tmp_path / "voice_test.db"
    monkeypatch.setenv("DB_PATH", str(db_path))
    import db
    db._conn = None
    conn = db.get_conn()
    yield conn
    db._conn = None


def _seed_baseline(conn, *, n=10, event_ts="2026-06-15T10:00:00Z"):
    """Seed rows inside the 14-day baseline window before event_ts."""
    ref = datetime.fromisoformat(event_ts.replace("Z", "+00:00"))
    base = ref - timedelta(days=n)
    for i in range(n):
        ts = (base + timedelta(days=i)).isoformat()
        conn.execute(
            """INSERT INTO voice_checkins
               (timestamp, speech_rate_wpm, clarity_score, sentiment,
                confusion_markers, response_latency_s, duration_s, baseline_deviation_cosine)
               VALUES (?, 138, 0.87, 'positive', 0, 1.2, 142, 0.04)""",
            (ts,),
        )
    conn.commit()


# ── 1. Passthrough ───────────────────────────────────────────────────────────

def test_passthrough_returns_injected_cosine_verbatim():
    payload = {"baseline_deviation_cosine": 0.38, "speech_rate_wpm": 89}
    assert compute_voice_deviation(payload) == 0.38


def test_passthrough_004_seed_value():
    payload = {"baseline_deviation_cosine": 0.04}
    assert compute_voice_deviation(payload) == 0.04


def test_passthrough_ignores_bool_cosine():
    payload = {"baseline_deviation_cosine": True, "speech_rate_wpm": 100}
    assert compute_voice_deviation(payload, conn=None, event_ts="2026-06-01T10:00:00Z") is None


# ── 2. Field deviation / combine ─────────────────────────────────────────────

def test_clarity_drop_increases_deviation(voice_db):
    _seed_baseline(voice_db, n=10)
    payload = {
        "speech_rate_wpm": 138,
        "clarity_score": 0.40,
        "response_latency_s": 1.2,
        "confusion_markers": False,
    }
    dev = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    assert dev is not None
    assert dev > 0.15


def test_latency_absolute_backstop_at_3s(voice_db):
    _seed_baseline(voice_db, n=10)
    payload = {
        "speech_rate_wpm": 138,
        "clarity_score": 0.87,
        "response_latency_s": 4.7,
        "confusion_markers": False,
    }
    dev = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    assert dev is not None
    assert dev >= 0.2


def test_confusion_floor_elevates_score(voice_db):
    _seed_baseline(voice_db, n=10)
    payload = {
        "speech_rate_wpm": 138,
        "clarity_score": 0.87,
        "response_latency_s": 1.2,
        "confusion_markers": True,
    }
    dev = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    assert dev is not None
    assert dev >= 0.17


def test_score_clamped_and_rounded_2dp(voice_db):
    _seed_baseline(voice_db, n=10)
    payload = {
        "speech_rate_wpm": 50,
        "clarity_score": 0.2,
        "response_latency_s": 10.0,
        "confusion_markers": True,
    }
    dev = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    assert dev is not None
    assert dev >= 0.8
    assert dev <= 1.0


def test_deterministic_same_inputs_same_output(voice_db):
    _seed_baseline(voice_db, n=10)
    payload = {
        "speech_rate_wpm": 105,
        "clarity_score": 0.68,
        "response_latency_s": 2.9,
        "confusion_markers": False,
    }
    a = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    b = compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z")
    assert a == b


# ── 3. Cold-start gates ──────────────────────────────────────────────────────

def test_cold_start_insufficient_samples_returns_none(voice_db):
    _seed_baseline(voice_db, n=3)
    payload = {"speech_rate_wpm": 100, "clarity_score": 0.5, "response_latency_s": 2.0,
               "confusion_markers": False}
    assert compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z") is None


def test_cold_start_insufficient_distinct_days_returns_none(voice_db):
    base = datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc)
    for i in range(6):
        voice_db.execute(
            """INSERT INTO voice_checkins
               (timestamp, speech_rate_wpm, clarity_score, sentiment,
                confusion_markers, response_latency_s, duration_s, baseline_deviation_cosine)
               VALUES (?, 138, 0.87, 'positive', 0, 1.2, 142, 0.04)""",
            ((base + timedelta(hours=i)).isoformat(),),
        )
    voice_db.commit()
    payload = {"speech_rate_wpm": 100, "clarity_score": 0.5, "response_latency_s": 2.0,
               "confusion_markers": False}
    assert compute_voice_deviation(payload, conn=voice_db, event_ts="2026-06-15T10:00:00Z") is None


# ── 4. enrich_event ────────────────────────────────────────────────────────

def test_enrich_event_passthrough_does_not_recompute(voice_db):
    event = {
        "event_type": "voice_distress_detected",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 89,
            "clarity_score": 0.61,
            "sentiment": "confused",
            "confusion_markers": True,
            "response_latency_s": 4.7,
            "baseline_deviation_cosine": 0.38,
        },
    }
    out = enrich_event(event)
    assert out["payload"]["baseline_deviation_cosine"] == 0.38


def test_enrich_event_computes_when_missing(voice_db):
    _seed_baseline(voice_db, n=10)
    event = {
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 105,
            "clarity_score": 0.68,
            "sentiment": "neutral",
            "confusion_markers": False,
            "response_latency_s": 2.9,
            "duration_s": 110,
        },
    }
    out = enrich_event(event)
    assert "baseline_deviation_cosine" in out["payload"]
    assert isinstance(out["payload"]["baseline_deviation_cosine"], float)


def test_enrich_event_does_not_mutate_input(voice_db):
    _seed_baseline(voice_db, n=10)
    event = {
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 138,
            "clarity_score": 0.87,
            "sentiment": "positive",
            "confusion_markers": False,
            "response_latency_s": 1.2,
            "duration_s": 142,
        },
    }
    original = copy.deepcopy(event)
    enrich_event(event)
    assert event == original


def test_enrich_event_persists_voice_checkins_row(voice_db):
    _seed_baseline(voice_db, n=10)
    event = {
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-20T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 138,
            "clarity_score": 0.87,
            "sentiment": "positive",
            "confusion_markers": False,
            "response_latency_s": 1.2,
            "duration_s": 142,
        },
    }
    enrich_event(event)
    row = voice_db.execute(
        "SELECT speech_rate_wpm FROM voice_checkins WHERE timestamp = ?",
        ("2026-06-20T10:00:00Z",),
    ).fetchone()
    assert row is not None
    assert row[0] == 138


def test_reset_voice_state_is_noop():
    reset_voice_state()


# ── 5. Ingestion hook (not fallback) ─────────────────────────────────────────

def test_ingestion_hook_enriches_voice_event(voice_db):
    import ingestion
    ingestion.reset_state()
    event = {
        "event_type": "voice_distress_detected",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "confidence": 0.83,
        "payload": {
            "speech_rate_wpm": 89,
            "clarity_score": 0.61,
            "sentiment": "confused",
            "confusion_markers": True,
            "response_latency_s": 4.7,
            "baseline_deviation_cosine": 0.38,
        },
    }
    ingestion.process_event(event)
    row = voice_db.execute(
        "SELECT baseline_deviation_cosine FROM voice_checkins ORDER BY id DESC LIMIT 1"
    ).fetchone()
    assert row is not None
    assert row[0] == 0.38


def test_ingestion_voice_completed_still_green(voice_db):
    import ingestion
    ingestion.reset_state()
    event = {
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "confidence": 0.91,
        "payload": {
            "speech_rate_wpm": 138,
            "clarity_score": 0.87,
            "sentiment": "positive",
            "confusion_markers": False,
            "response_latency_s": 1.2,
            "duration_s": 142,
        },
    }
    sse = ingestion.process_event(event)
    sig = [e for e in sse if e["event"] == "signal_update" and e["payload"]["signal"] == "voice_checkin"]
    assert sig
    assert sig[0]["payload"]["state"] == "green"


# ── 6. Fallback untouched ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fallback_untouched_no_enrichment():
    import main
    event = {
        "event_type": "voice_distress_detected",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 89,
            "clarity_score": 0.61,
            "confusion_markers": True,
            "response_latency_s": 4.7,
            "baseline_deviation_cosine": 0.38,
        },
    }
    sse = await main._process_event_inplace(event)
    vc = [e for e in sse if e.get("event") == "signal_update" and e["payload"]["signal"] == "voice_checkin"]
    assert vc[0]["payload"]["state"] == "red"
    assert vc[0]["payload"]["cosine_distance"] == 0.38


@pytest.mark.asyncio
async def test_existing_three_voice_tests_unchanged_pattern():
    """Mirror test_ingest voice assertions via fallback path."""
    import main

    normal = {
        "event_type": "voice_checkin_completed",
        "source": "voice_system",
        "timestamp": "2026-06-15T10:00:00Z",
        "payload": {
            "speech_rate_wpm": 138, "clarity_score": 0.87,
            "sentiment": "positive", "confusion_markers": False,
            "response_latency_s": 1.2,
        },
    }
    sse = await main._process_event_inplace(normal)
    vc = [e for e in sse if e["payload"].get("signal") == "voice_checkin"][0]
    assert vc["payload"]["state"] == "green"

    confused = dict(normal)
    confused["payload"] = {**normal["payload"], "confusion_markers": True}
    sse2 = await main._process_event_inplace(confused)
    vc2 = [e for e in sse2 if e["payload"].get("signal") == "voice_checkin"][0]
    assert vc2["payload"]["state"] == "red"


def test_voice_event_types_frozen_set():
    assert "voice_checkin_completed" in VOICE_EVENT_TYPES
    assert "voice_distress_detected" in VOICE_EVENT_TYPES
