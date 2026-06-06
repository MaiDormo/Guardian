"""
connection.py — "Best time to connect" inference module.

Queries the existing events + voice_checkins tables to find Ah-Ma's recurring
quiet waking hours, cross-references voice clarity/sentiment by hour, then
intersects with the child's declared free windows from connection_prefs.json.

Public API:
    compute_connection_window(prefs) -> dict   main entry point
    load_prefs(path)                 -> dict   load connection_prefs.json
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config defaults (overridden by config.py constants)
# ---------------------------------------------------------------------------

try:
    from config import (  # noqa: PLC0415
        CONNECTION_BASELINE_DAYS,
        CONNECTION_WINDOW_END_H,
        CONNECTION_WINDOW_START_H,
        CONNECTION_MIN_PRESENCE_FREQ,
    )
except ImportError:
    CONNECTION_BASELINE_DAYS = 14
    CONNECTION_WINDOW_START_H = 10
    CONNECTION_WINDOW_END_H = 20
    CONNECTION_MIN_PRESENCE_FREQ = 3


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_connection_window(prefs: dict, *, now: Optional[datetime] = None) -> dict:
    """
    Return the best time for the child to connect with Ah-Ma.

    Falls back gracefully at every layer — never crashes, always returns
    a usable payload that the endpoint and frontend can render.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    try:
        from db import get_conn  # noqa: PLC0415
        conn = get_conn()
    except Exception as exc:
        log.warning("connection: DB unavailable (%s) — using stub", exc)
        return _stub_window(prefs)

    quiet_hours = _quiet_waking_hours(conn)
    voice_quality = _voice_quality_by_hour(conn)

    if not quiet_hours:
        log.info("connection: no presence history — using stub")
        return _stub_window(prefs)

    # Rank hours: presence frequency × voice quality score
    ranked = _rank_hours(quiet_hours, voice_quality)
    overlapping = _intersect(ranked, prefs.get("free_windows", []))

    if not overlapping:
        # No overlap found — suggest top parent hour anyway, note no overlap
        top_hour, top_freq = ranked[0]
        return _build_result(
            best_hour=top_hour,
            freq=top_freq,
            voice_quality=voice_quality,
            overlap_found=False,
            child_name=prefs.get("child_name", "You"),
            now=now,
        )

    best_hour, best_freq = overlapping[0]
    return _build_result(
        best_hour=best_hour,
        freq=best_freq,
        voice_quality=voice_quality,
        overlap_found=True,
        child_name=prefs.get("child_name", "You"),
        now=now,
    )


def load_prefs(path: Optional[str] = None) -> dict:
    """Load connection_prefs.json. Returns safe defaults on any failure."""
    if path is None:
        # Resolve relative to repo root (parent of backend/)
        path = str(Path(__file__).parent.parent / "connection_prefs.json")
    try:
        import json
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        log.info("connection_prefs.json not found — using defaults")
    except Exception as exc:
        log.warning("Failed to load connection_prefs (%s) — using defaults", exc)
    return {"child_name": "You", "free_windows": ["13:00-17:00", "19:00-21:00"]}


# ---------------------------------------------------------------------------
# Internal: SQL queries
# ---------------------------------------------------------------------------


def _quiet_waking_hours(conn) -> list[tuple[int, int]]:
    """
    Return [(hour, freq)] for Ah-Ma's most frequent waking non-bedroom presence,
    sorted by frequency descending. Bedroom excluded — we want alert/social hours.
    """
    try:
        rows = conn.execute(
            """
            SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
                   COUNT(*) AS freq
            FROM events
            WHERE event_type = 'presence_detected'
              AND room NOT IN ('bedroom')
              AND CAST(strftime('%H', timestamp) AS INTEGER)
                  BETWEEN ? AND ?
              AND timestamp > datetime('now', ?)
            GROUP BY hour
            HAVING freq >= ?
            ORDER BY freq DESC
            LIMIT 8
            """,
            (
                CONNECTION_WINDOW_START_H,
                CONNECTION_WINDOW_END_H,
                f"-{CONNECTION_BASELINE_DAYS} days",
                CONNECTION_MIN_PRESENCE_FREQ,
            ),
        ).fetchall()
        return [(r["hour"], r["freq"]) for r in rows]
    except Exception as exc:
        log.warning("_quiet_waking_hours query failed (%s)", exc)
        return []


def _voice_quality_by_hour(conn) -> dict[int, dict]:
    """
    Return {hour: {avg_clarity, positivity_rate}} from voice_checkins.
    Empty dict if table has no rows — caller degrades gracefully.
    """
    try:
        rows = conn.execute(
            """
            SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
                   AVG(clarity_score)                          AS avg_clarity,
                   AVG(CASE sentiment WHEN 'positive' THEN 1.0 ELSE 0.0 END)
                                                               AS positivity
            FROM voice_checkins
            GROUP BY hour
            """
        ).fetchall()
        return {
            r["hour"]: {
                "avg_clarity": round(r["avg_clarity"] or 0.0, 3),
                "positivity": round(r["positivity"] or 0.0, 3),
            }
            for r in rows
        }
    except Exception as exc:
        log.warning("_voice_quality_by_hour query failed (%s)", exc)
        return {}


# ---------------------------------------------------------------------------
# Internal: ranking + overlap
# ---------------------------------------------------------------------------


def _rank_hours(
    quiet_hours: list[tuple[int, int]],
    voice_quality: dict[int, dict],
) -> list[tuple[int, int]]:
    """
    Re-rank presence hours by composite score:
      score = presence_freq (normalised) + clarity_bonus + positivity_bonus
    When voice_quality is empty, order is presence frequency only.
    """
    if not voice_quality:
        return quiet_hours  # already sorted by freq

    max_freq = quiet_hours[0][1] if quiet_hours else 1

    def score(hour: int, freq: int) -> float:
        vq = voice_quality.get(hour, {})
        normalised_freq = freq / max_freq
        clarity = vq.get("avg_clarity", 0.5)
        positivity = vq.get("positivity", 0.5)
        return normalised_freq + (clarity * 0.5) + (positivity * 0.3)

    return sorted(quiet_hours, key=lambda h: score(h[0], h[1]), reverse=True)


def _intersect(
    ranked_parent_hours: list[tuple[int, int]],
    child_free_windows: list[str],
) -> list[tuple[int, int]]:
    """
    Return ranked parent hours that fall inside at least one child free window.
    Windows are "HH:MM-HH:MM" strings (24h).
    """
    parsed: list[tuple[int, int]] = []
    for window in child_free_windows:
        try:
            start_str, end_str = window.split("-")
            start_h = int(start_str.split(":")[0])
            end_h = int(end_str.split(":")[0])
            parsed.append((start_h, end_h))
        except Exception:
            log.warning("Unparseable free window: %s", window)

    if not parsed:
        return []

    return [
        (hour, freq)
        for hour, freq in ranked_parent_hours
        if any(start <= hour < end for start, end in parsed)
    ]


# ---------------------------------------------------------------------------
# Internal: result builders
# ---------------------------------------------------------------------------


def _build_result(
    best_hour: int,
    freq: int,
    voice_quality: dict[int, dict],
    overlap_found: bool,
    child_name: str,
    now: datetime,
) -> dict:
    vq = voice_quality.get(best_hour, {})
    avg_clarity = vq.get("avg_clarity", None)
    positivity = vq.get("positivity", None)

    # Confidence tier
    if overlap_found and avg_clarity is not None and avg_clarity >= 0.75:
        confidence = "high"
    elif overlap_found:
        confidence = "moderate"
    else:
        confidence = "low"

    # Human-readable window string
    best_window = f"{best_hour:02d}:00-{best_hour + 1:02d}:00"

    # Rationale — mirrors the cached Gemma 4 voice in agent.py
    rationale = _build_rationale(
        best_hour=best_hour,
        best_window=best_window,
        freq=freq,
        avg_clarity=avg_clarity,
        positivity=positivity,
        overlap_found=overlap_found,
        child_name=child_name,
    )

    return {
        "best_window": best_window,
        "best_hour": best_hour,
        "overlap_with_child": overlap_found,
        "confidence": confidence,
        "evidence": {
            "presence_days": freq,
            "baseline_days": CONNECTION_BASELINE_DAYS,
            "avg_clarity": avg_clarity,
            "positivity_rate": positivity,
        },
        "rationale": rationale,
        "updated_at": now.isoformat(),
    }


def _build_rationale(
    best_hour: int,
    best_window: str,
    freq: int,
    avg_clarity: Optional[float],
    positivity: Optional[float],
    overlap_found: bool,
    child_name: str,
) -> str:
    clarity_str = (
        f"Voice clarity in this window averages {avg_clarity:.2f} — "
        f"{'above' if avg_clarity and avg_clarity >= 0.8 else 'within'} her baseline. "
        if avg_clarity is not None
        else ""
    )
    overlap_str = (
        f"{child_name} is free at this time. "
        if overlap_found
        else f"No overlap with {child_name}'s schedule — consider rescheduling. "
    )
    return (
        f"Ah-Ma is consistently present and calm between {best_window}, "
        f"observed across {freq} of the last {CONNECTION_BASELINE_DAYS} days. "
        f"{clarity_str}"
        f"{overlap_str}"
        f"This is the optimal moment to connect — not a fixed reminder, "
        f"but a pattern Guardian learned from her daily rhythm."
    )


def _stub_window(prefs: dict) -> dict:
    """Fallback when DB is unavailable — returns a plausible hardcoded window."""
    now = datetime.now(timezone.utc)
    child_name = prefs.get("child_name", "You")
    return {
        "best_window": "15:00-16:00",
        "best_hour": 15,
        "overlap_with_child": True,
        "confidence": "moderate",
        "evidence": {
            "presence_days": None,
            "baseline_days": CONNECTION_BASELINE_DAYS,
            "avg_clarity": None,
            "positivity_rate": None,
        },
        "rationale": (
            f"Ah-Ma is typically calm and present in the early afternoon. "
            f"{child_name} is free at this time. "
            f"(Historical data unavailable — connect once to build a baseline.)"
        ),
        "updated_at": now.isoformat(),
    }
