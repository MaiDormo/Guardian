import type {
  ConnectionAckPayload,
  ConnectionWindowPayload,
  FallPayload,
  LocationUpdatePayload,
  PresencePayload,
  ReasoningPayload,
  SignalStateData,
  WanderingPayload,
} from "@/lib/types";

export function makeSignal(
  signal: SignalStateData["signal"],
  overrides: Partial<SignalStateData> = {}
): SignalStateData {
  return {
    signal,
    state: "green",
    reason: "",
    cosine_distance: null,
    updated_at: null,
    ...overrides,
  };
}

export const fallPayload: FallPayload = {
  room: "bathroom",
  posture: "lying",
  stationary_s: 45,
  confidence: 0.92,
  updated_at: "2026-06-07T10:00:00Z",
};

export const locationNormal: LocationUpdatePayload = {
  trajectory_density_score: 0.91,
  baseline_cluster_match: true,
  distance_from_home_m: 0,
  updated_at: "2026-06-07T09:00:00Z",
};

export const wanderingPayload: WanderingPayload = {
  trajectory_density_score: 0.32,
  baseline_cluster_match: false,
  minutes_outside_baseline_footprint: 18,
  updated_at: "2026-06-07T11:00:00Z",
};

export const connectionWindow: ConnectionWindowPayload = {
  best_window: "2:00 – 3:30 PM",
  best_hour: 14,
  overlap_with_child: true,
  confidence: "high",
  evidence: {
    presence_days: 12,
    baseline_days: 14,
    avg_clarity: 0.87,
    positivity_rate: 0.72,
  },
  rationale: "Calm afternoon window from 14-day baseline.",
  updated_at: "2026-06-07T12:00:00Z",
};

export const connectionAck: ConnectionAckPayload = {
  dispatched: true,
  channel: "WeCom",
  best_window: "2:00 – 3:30 PM",
  rationale: "Nudge sent",
  message_preview: "Call Ah-Ma between 2–3:30 PM",
  updated_at: "2026-06-07T12:05:00Z",
};

export const reasoningEntry: ReasoningPayload = {
  signal: "ate",
  cosine_distance: 0.18,
  baseline_window_days: 14,
  features_considered: ["meal_time", "duration"],
  rationale: "Breakfast delayed 90 minutes vs baseline.",
  updated_at: "2026-06-07T08:30:00Z",
};

export function makePresence(
  room: PresencePayload["room"],
  occupied: boolean,
  fall = false
): PresencePayload {
  return {
    room,
    occupied,
    fall,
    updated_at: "2026-06-07T09:00:00Z",
  };
}
