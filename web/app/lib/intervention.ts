import { apiUrl } from "./api";
import type { InterventionAckPayload, SignalStateData } from "./types";

const CRISIS_SIGNALS = ["voice_checkin", "location", "routine", "took_meds"] as const;

export function isInterventionRecommended(
  signals: Record<string, SignalStateData>,
  interventionAck: InterventionAckPayload | null
): boolean {
  if (interventionAck) return true;
  return CRISIS_SIGNALS.some((s) => signals[s]?.state === "red");
}

export async function dispatchIntervention(): Promise<void> {
  await fetch(`${apiUrl()}/trigger/intervention`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}
