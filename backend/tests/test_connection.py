"""
Tests for connection.py — "Best time to connect" inference module.
"""

import sqlite3
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from connection import (
    _build_rationale,
    _intersect,
    _quiet_waking_hours,
    _rank_hours,
    _stub_window,
    _voice_quality_by_hour,
    compute_connection_window,
    load_prefs,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_conn(events: list[dict], voice_rows: list[dict]) -> MagicMock:
    """Return a mock DB connection pre-loaded with test data."""
    conn = MagicMock()

    def execute_side_effect(sql, params=()):
        sql_stripped = sql.strip().lower()
        if "from events" in sql_stripped:
            rows = []
            for e in events:
                row = MagicMock()
                row.__getitem__ = lambda self, k: e[k]
                rows.append(row)
            result = MagicMock()
            result.fetchall.return_value = rows
            return result
        elif "from voice_checkins" in sql_stripped:
            rows = []
            for v in voice_rows:
                row = MagicMock()
                row.__getitem__ = lambda self, k: v[k]
                rows.append(row)
            result = MagicMock()
            result.fetchall.return_value = rows
            return result
        result = MagicMock()
        result.fetchall.return_value = []
        return result

    conn.execute.side_effect = execute_side_effect
    return conn


# ---------------------------------------------------------------------------
# _intersect
# ---------------------------------------------------------------------------


class TestIntersect:
    def test_basic_overlap(self):
        ranked = [(15, 11), (16, 9), (19, 8)]
        windows = ["13:00-17:00", "19:00-21:00"]
        result = _intersect(ranked, windows)
        assert result == [(15, 11), (16, 9), (19, 8)]

    def test_no_overlap(self):
        ranked = [(10, 5), (11, 4)]
        windows = ["19:00-21:00"]
        assert _intersect(ranked, windows) == []

    def test_empty_parent_hours(self):
        assert _intersect([], ["13:00-17:00"]) == []

    def test_empty_windows(self):
        ranked = [(15, 11), (16, 9)]
        assert _intersect(ranked, []) == []

    def test_partial_overlap(self):
        ranked = [(15, 11), (10, 5)]
        windows = ["13:00-17:00"]
        result = _intersect(ranked, windows)
        assert result == [(15, 11)]
        assert (10, 5) not in result

    def test_malformed_window_skipped(self):
        ranked = [(15, 11)]
        windows = ["not-a-window", "13:00-17:00"]
        result = _intersect(ranked, windows)
        assert result == [(15, 11)]

    def test_boundary_exclusive_end(self):
        # Window 13:00-17:00 → hours 13, 14, 15, 16 included; 17 excluded
        ranked = [(17, 5), (16, 8)]
        windows = ["13:00-17:00"]
        result = _intersect(ranked, windows)
        assert (17, 5) not in result
        assert (16, 8) in result


# ---------------------------------------------------------------------------
# _rank_hours
# ---------------------------------------------------------------------------


class TestRankHours:
    def test_no_voice_data_preserves_freq_order(self):
        hours = [(15, 11), (16, 9), (19, 8)]
        result = _rank_hours(hours, {})
        assert result == hours

    def test_voice_quality_promotes_clearer_hour(self):
        # hour 16 has slightly lower freq but substantially better voice quality.
        # Scores: hour15 = 10/10 + 0.60*0.5 + 0.50*0.3 = 1.45
        #         hour16 =  9/10 + 0.95*0.5 + 0.90*0.3 = 1.645
        hours = [(15, 10), (16, 9)]
        voice = {
            15: {"avg_clarity": 0.60, "positivity": 0.50},
            16: {"avg_clarity": 0.95, "positivity": 0.90},
        }
        result = _rank_hours(hours, voice)
        assert result[0][0] == 16

    def test_missing_voice_entry_uses_defaults(self):
        hours = [(15, 10), (19, 9)]
        voice = {15: {"avg_clarity": 0.88, "positivity": 0.80}}
        result = _rank_hours(hours, voice)
        assert result[0][0] == 15


# ---------------------------------------------------------------------------
# _stub_window
# ---------------------------------------------------------------------------


class TestStubWindow:
    def test_returns_valid_shape(self):
        result = _stub_window({"child_name": "Tanmay", "free_windows": []})
        assert result["best_window"] == "15:00-16:00"
        assert result["confidence"] == "moderate"
        assert "rationale" in result
        assert "updated_at" in result

    def test_uses_child_name(self):
        result = _stub_window({"child_name": "Elia"})
        assert "Elia" in result["rationale"]


# ---------------------------------------------------------------------------
# _build_rationale
# ---------------------------------------------------------------------------


class TestBuildRationale:
    def test_overlap_found_mentions_child(self):
        r = _build_rationale(
            best_hour=15, best_window="15:00-16:00", freq=12,
            avg_clarity=0.88, positivity=0.80, overlap_found=True,
            child_name="Tanmay",
        )
        assert "Tanmay" in r
        assert "15:00-16:00" in r

    def test_no_overlap_mentions_reschedule(self):
        r = _build_rationale(
            best_hour=15, best_window="15:00-16:00", freq=12,
            avg_clarity=0.88, positivity=0.80, overlap_found=False,
            child_name="Tanmay",
        )
        assert "rescheduling" in r.lower() or "No overlap" in r

    def test_no_voice_data_does_not_crash(self):
        r = _build_rationale(
            best_hour=15, best_window="15:00-16:00", freq=10,
            avg_clarity=None, positivity=None, overlap_found=True,
            child_name="Tanmay",
        )
        assert isinstance(r, str)
        assert len(r) > 0


# ---------------------------------------------------------------------------
# compute_connection_window — with mocked DB
# ---------------------------------------------------------------------------


class TestComputeConnectionWindow:
    def _prefs(self):
        return {"child_name": "Tanmay", "free_windows": ["13:00-17:00", "19:00-21:00"]}

    def test_returns_valid_shape_with_data(self):
        presence = [{"hour": 15, "freq": 12}, {"hour": 16, "freq": 10}, {"hour": 19, "freq": 9}]
        voice = [{"hour": 15, "avg_clarity": 0.88, "positivity": 0.80}]

        with patch("db.get_conn") as mock_gc:
            conn = _make_conn(presence, voice)
            mock_gc.return_value = conn
            result = compute_connection_window(self._prefs())

        assert "best_window" in result
        assert "confidence" in result
        assert "rationale" in result
        assert "evidence" in result
        assert "updated_at" in result

    def test_high_confidence_when_overlap_and_good_clarity(self):
        presence = [{"hour": 15, "freq": 12}]
        voice = [{"hour": 15, "avg_clarity": 0.88, "positivity": 0.80}]

        with patch("db.get_conn") as mock_gc:
            conn = _make_conn(presence, voice)
            mock_gc.return_value = conn
            result = compute_connection_window(self._prefs())

        assert result["confidence"] == "high"
        assert result["overlap_with_child"] is True

    def test_low_confidence_when_no_overlap(self):
        # Only hour 10 has presence, which is outside child windows
        presence = [{"hour": 10, "freq": 8}]
        voice = []

        with patch("db.get_conn") as mock_gc:
            conn = _make_conn(presence, voice)
            mock_gc.return_value = conn
            result = compute_connection_window(self._prefs())

        assert result["confidence"] == "low"
        assert result["overlap_with_child"] is False

    def test_empty_presence_returns_stub(self):
        with patch("db.get_conn") as mock_gc:
            conn = _make_conn([], [])
            mock_gc.return_value = conn
            result = compute_connection_window(self._prefs())

        # Should fall through to _stub_window
        assert result["best_window"] == "15:00-16:00"
        assert result["confidence"] == "moderate"

    def test_db_unavailable_returns_stub(self):
        with patch("db.get_conn", side_effect=Exception("DB not found")):
            result = compute_connection_window(self._prefs())

        assert result["best_window"] == "15:00-16:00"
        assert "rationale" in result

    def test_empty_voice_checkins_degrades_gracefully(self):
        """No voice data → presence-only result, confidence moderate not high."""
        presence = [{"hour": 15, "freq": 12}]
        voice = []  # empty

        with patch("db.get_conn") as mock_gc:
            conn = _make_conn(presence, voice)
            mock_gc.return_value = conn
            result = compute_connection_window(self._prefs())

        assert result["confidence"] in ("moderate", "low")
        assert "rationale" in result


# ---------------------------------------------------------------------------
# load_prefs
# ---------------------------------------------------------------------------


class TestLoadPrefs:
    def test_returns_defaults_on_missing_file(self, tmp_path):
        result = load_prefs(str(tmp_path / "nonexistent.json"))
        assert "free_windows" in result
        assert "child_name" in result

    def test_loads_valid_file(self, tmp_path):
        import json
        prefs = {"child_name": "Elia", "free_windows": ["09:00-12:00"]}
        path = tmp_path / "prefs.json"
        path.write_text(json.dumps(prefs))
        result = load_prefs(str(path))
        assert result["child_name"] == "Elia"
        assert result["free_windows"] == ["09:00-12:00"]

    def test_returns_defaults_on_malformed_json(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text("{invalid json")
        result = load_prefs(str(path))
        assert "free_windows" in result
