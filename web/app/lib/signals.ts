import type { SignalName, SignalState } from "./types";

export const SIGNAL_NAMES: SignalName[] = [
  "woke_up",
  "ate",
  "took_meds",
  "rested_well",
  "helper_present",
  "voice_checkin",
  "location",
  "routine",
];

export const SIGNAL_LABELS: Record<SignalName, string> = {
  woke_up: "Woke Up",
  ate: "Ate",
  took_meds: "Took Meds",
  rested_well: "Rested Well",
  helper_present: "Helper Present",
  voice_checkin: "Voice Check-In",
  location: "Location",
  routine: "Routine",
};

export function formatSignalLabel(name: string): string {
  return SIGNAL_LABELS[name as SignalName] || name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const STATE_CONFIG: Record<SignalState, { label: string; badgeClass: string; cardBorder: string }> = {
  green: {
    label: "NORMAL",
    badgeClass: "bg-primary-container text-on-primary-container",
    cardBorder: "border-l-4 border-l-primary",
  },
  amber: {
    label: "FAIR",
    badgeClass: "bg-amber-100 text-amber-800",
    cardBorder: "border-l-4 border-l-amber-400",
  },
  red: {
    label: "ALERT",
    badgeClass: "bg-error text-on-error",
    cardBorder: "border-l-4 border-l-error",
  },
  unknown: {
    label: "IDLE",
    badgeClass: "bg-surface-container-highest text-on-surface-variant",
    cardBorder: "border-l-4 border-l-outline-variant",
  },
};

export function emptySignalState() {
  return Object.fromEntries(
    SIGNAL_NAMES.map((name) => [
      name,
      { signal: name, state: "unknown" as SignalState, reason: "", cosine_distance: null, updated_at: null },
    ])
  );
}
