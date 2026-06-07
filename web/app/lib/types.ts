export type SignalName =
  | "woke_up"
  | "ate"
  | "took_meds"
  | "rested_well"
  | "helper_present"
  | "voice_checkin"
  | "location"
  | "routine";

export type SignalState = "green" | "amber" | "red" | "unknown";

export type Room = "bedroom" | "bathroom" | "kitchen" | "living_room";

export interface SignalStateData {
  signal: SignalName;
  state: SignalState;
  reason: string;
  cosine_distance: number | null;
  updated_at: string | null;
}

export interface PresencePayload {
  room: Room;
  occupied: boolean;
  fall: boolean;
  updated_at: string;
}

export interface FallPayload {
  room: Room;
  posture: string;
  stationary_s: number;
  confidence: number;
  updated_at: string;
}

export interface WanderingPayload {
  trajectory_density_score: number;
  baseline_cluster_match: boolean;
  minutes_outside_baseline_footprint: number;
  trace?: [number, number][];
  updated_at: string;
}

export interface ReasoningPayload {
  signal: string;
  cosine_distance: number | null;
  baseline_window_days: number | null;
  features_considered: string[];
  rationale: string;
  updated_at: string;
}

export interface InterventionAckPayload {
  dispatched: boolean;
  channel: string;
  message_preview: string;
  updated_at: string;
}

export interface LocationUpdatePayload {
  trajectory_density_score: number;
  baseline_cluster_match: boolean;
  distance_from_home_m: number;
  trace?: [number, number][];
  updated_at: string;
}

export interface StateResetPayload {
  scenario: string;
  updated_at: string;
}

export type ConnectionConfidence = "high" | "moderate" | "low";

export interface ConnectionWindowPayload {
  best_window: string;
  best_hour: number;
  overlap_with_child: boolean;
  confidence: ConnectionConfidence;
  evidence: {
    presence_days: number | null;
    baseline_days: number;
    avg_clarity: number | null;
    positivity_rate: number | null;
  };
  rationale: string;
  updated_at: string;
}

export interface ConnectionAckPayload {
  dispatched: boolean;
  channel: string;
  best_window: string;
  rationale: string;
  message_preview: string;
  updated_at: string;
}

export type Tab = "home" | "timeline" | "sensors" | "profile";

export type ToastType = "scenario" | "intervention" | "fall" | "connection" | "info";

export interface ToastEvent {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  timestamp: number;
}

export type SSEEvent =
  | { event: "signal_update"; payload: SignalStateData }
  | { event: "presence_update"; payload: PresencePayload }
  | { event: "location_update"; payload: LocationUpdatePayload }
  | { event: "wandering_detected"; payload: WanderingPayload }
  | { event: "fall_detected"; payload: FallPayload }
  | { event: "reasoning_update"; payload: ReasoningPayload }
  | { event: "intervention_ack"; payload: InterventionAckPayload }
  | { event: "connection_window"; payload: ConnectionWindowPayload }
  | { event: "connection_ack"; payload: ConnectionAckPayload }
  | { event: "state_reset"; payload: StateResetPayload }
  | { event: "ping"; payload: Record<string, never> };
