"""
config.py — Single source of truth for Guardian data-layer constants.

PRD references:
  §5.1  Signal thresholds
  §5.2  State machine constants (COLD_START_DAYS — ONE constant, ONE place)
  §4.2  Baseline window / embedding model
  §5.4  GPS home coordinates
"""

# State machine
COLD_START_DAYS: int = 7          # §5.2: no cosine comparison before 7 days
BASELINE_WINDOW_DAYS: int = 14    # §4.2 glossary: rolling comparison window

# Routine cosine thresholds (§5.1 row 8, §5.2)
ROUTINE_COSINE_RED: float = 0.25  # >=0.25 → red
ROUTINE_COSINE_AMBER: float = 0.15  # [0.15, 0.25) → amber

# Location density threshold (§5.1 row 7)
LOCATION_DENSITY_AMBER: float = 0.15  # >0.15 → amber (else red) when cluster_match=False

# Woke-up morning window (§5.1 row 1): bedroom motion hours [5, 11] inclusive
WOKE_WINDOW_START_H: int = 5
WOKE_WINDOW_END_H: int = 11

# Ate dwell threshold (§5.1 row 2)
ATE_DWELL_GREEN_S: int = 300   # >=300s → green; 0 < dwell < 300 → amber

# Amber escalation timeouts (§5.2)
AMBER_TIMEOUT_PASSIVE_H: int = 4   # mmwave_*, baseline sources
AMBER_TIMEOUT_ACTIVE_H: int = 2    # voice_system, pill_dispenser, gps_tracker

# Wandering minimum outside-footprint time (§5.1 row 7, §5.4 schema)
WANDER_MIN_MINUTES: int = 30

# Embedding (§4.2)
EMBED_DIM: int = 768
EMBED_MODEL: str = "nomic-embed-text"

# Shenzhen home GPS cluster centre (§5.4 normal location schema)
HOME_LAT: float = 22.5431
HOME_LNG: float = 114.0579

# Sources whose amber timeout is 2h (others = 4h)
ACTIVE_SOURCES: frozenset[str] = frozenset(
    {"voice_system", "pill_dispenser", "gps_tracker"}
)

# Connection window inference
CONNECTION_BASELINE_DAYS: int = 14     # days of presence history to query
CONNECTION_WINDOW_START_H: int = 10    # earliest waking hour to consider
CONNECTION_WINDOW_END_H: int = 20      # latest hour to consider
CONNECTION_MIN_PRESENCE_FREQ: int = 3  # minimum days to count a recurring hour

# Voice deviation index (voice_checkin.py) — reuses COLD_START_DAYS / ROUTINE_COSINE_* for thresholds
VOICE_WEIGHT_CLARITY: float = 0.30
VOICE_WEIGHT_LATENCY: float = 0.30
VOICE_WEIGHT_SPEECH_RATE: float = 0.20
VOICE_WEIGHT_CONFUSION: float = 0.20
VOICE_LATENCY_ABSOLUTE_RED_S: float = 3.0
VOICE_BASELINE_MIN_SAMPLES: int = 5
VOICE_CONFUSION_FLOOR: float = 0.85

# Safety reflex — auto-dispatch on fall_detected (main.py reads env; documented here)
AUTO_DISPATCH_ON_FALL_DEFAULT: bool = True
