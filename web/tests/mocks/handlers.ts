import { http, HttpResponse } from "msw";
import type {
  ConnectionWindowPayload,
  SignalStateData,
} from "@/lib/types";

const API = "http://localhost:8000";

export const defaultStatus = {
  signals: {
    woke_up: {
      signal: "woke_up",
      state: "green",
      reason: "Woke at 07:15",
      cosine_distance: 0.04,
      updated_at: "2026-06-07T07:15:00Z",
    },
    ate: {
      signal: "ate",
      state: "green",
      reason: "Had breakfast",
      cosine_distance: 0.03,
      updated_at: "2026-06-07T08:00:00Z",
    },
  } as Record<string, Partial<SignalStateData>>,
};

export const defaultConnectionWindow: ConnectionWindowPayload = {
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
  rationale: "Ah-Ma is calm and clear-spoken between 2–3:30 PM on 12 of 14 baseline days.",
  updated_at: "2026-06-07T12:00:00Z",
};

export const handlers = [
  http.get(`${API}/status`, () => HttpResponse.json(defaultStatus)),
  http.get(`${API}/api/connection-window`, () =>
    HttpResponse.json(defaultConnectionWindow)
  ),
  http.post(`${API}/trigger/intervention`, () =>
    HttpResponse.json({ ok: true })
  ),
  http.post(`${API}/trigger/connection`, () => HttpResponse.json({ ok: true })),
  http.post(`${API}/scenario/:name`, ({ params }) =>
    HttpResponse.json({ scenario: params.name })
  ),
];

export { API };
