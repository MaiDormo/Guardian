"use client";

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  SSEEvent,
  SignalState,
  SignalStateData,
  PresencePayload,
  FallPayload,
  WanderingPayload,
  ReasoningPayload,
  InterventionAckPayload,
  LocationUpdatePayload,
  ConnectionWindowPayload,
  ConnectionAckPayload,
} from "./types";
import { SIGNAL_NAMES, emptySignalState } from "./signals";
import { apiUrl } from "./api";

export interface SSEState {
  signals: Record<string, SignalStateData>;
  presence: Record<string, PresencePayload>;
  wandering: WanderingPayload | null;
  fall: FallPayload | null;
  reasoning: ReasoningPayload[];
  interventionAck: InterventionAckPayload | null;
  connectionWindow: ConnectionWindowPayload | null;
  connectionAck: ConnectionAckPayload | null;
  location: LocationUpdatePayload | null;
  scenarioActive: string | null;
  backendConnected: boolean;
}

function demoConnectionWindow(): ConnectionWindowPayload {
  const now = new Date().toISOString();
  return {
    best_window: "15:00-16:00",
    best_hour: 15,
    overlap_with_child: true,
    confidence: "high",
    evidence: {
      presence_days: 12,
      baseline_days: 14,
      avg_clarity: 0.88,
      positivity_rate: 0.8,
    },
    rationale:
      "Ah-Ma is consistently present and calm between 15:00-16:00. " +
      "Voice clarity peaks in the early afternoon. Tanmay is free at this time.",
    updated_at: now,
  };
}

/** Honest empty state — used after scenario resets. */
function createEmptyState(): SSEState {
  return {
    signals: emptySignalState() as Record<string, SignalStateData>,
    presence: {},
    wandering: null,
    fall: null,
    reasoning: [],
    interventionAck: null,
    connectionWindow: null,
    connectionAck: null,
    location: null,
    scenarioActive: null,
    backendConnected: false,
  };
}

/** Polished demo placeholder before the backend connects. */
function createDemoState(): SSEState {
  const signals = emptySignalState() as Record<string, SignalStateData>;
  const now = new Date().toISOString();

  for (const name of SIGNAL_NAMES) {
    signals[name] = {
      signal: name,
      state: "green" as SignalState,
      reason: "",
      cosine_distance: 0.15,
      updated_at: now,
    };
  }
  signals.woke_up = { ...signals.woke_up, reason: "07:15" };
  signals.ate = { ...signals.ate, reason: "Breakfast at 08:00" };
  signals.took_meds = { ...signals.took_meds, reason: "Morning 3/3" };
  signals.rested_well = { ...signals.rested_well, reason: "7.5h sleep" };
  signals.helper_present = { ...signals.helper_present, reason: "Helper on site 08-10" };
  signals.voice_checkin = { ...signals.voice_checkin, reason: "Clear check-in at 08:30" };
  signals.location = { ...signals.location, reason: "Home area" };
  signals.routine = { ...signals.routine, reason: "On track" };

  return {
    signals,
    presence: {},
    wandering: null,
    fall: null,
    reasoning: [],
    interventionAck: null,
    connectionWindow: demoConnectionWindow(),
    connectionAck: null,
    location: {
      trajectory_density_score: 0.91,
      baseline_cluster_match: true,
      distance_from_home_m: 0,
      updated_at: now,
    },
    scenarioActive: null,
    backendConnected: false,
  };
}

function signalsFromStatus(raw: Record<string, Partial<SignalStateData>>): Record<string, SignalStateData> {
  const signals = emptySignalState() as Record<string, SignalStateData>;
  for (const name of SIGNAL_NAMES) {
    const data = raw[name];
    if (data && data.state && data.state !== "unknown") {
      signals[name] = {
        signal: name,
        state: data.state as SignalState,
        reason: data.reason || "",
        cosine_distance: data.cosine_distance ?? null,
        updated_at: data.updated_at ?? null,
      };
    }
  }
  return signals;
}

async function hydrateFromBackend(
  setState: Dispatch<SetStateAction<SSEState>>
): Promise<void> {
  const base = apiUrl();
  try {
    const [statusRes, connectionRes] = await Promise.all([
      fetch(`${base}/status`),
      fetch(`${base}/api/connection-window`),
    ]);

    if (!statusRes.ok) return;

    const status = await statusRes.json();
    const connection = connectionRes.ok ? await connectionRes.json() : null;

    setState((prev) => ({
      ...prev,
      backendConnected: true,
      signals: status.signals ? signalsFromStatus(status.signals) : prev.signals,
      connectionWindow:
        connection?.best_window ? connection : prev.connectionWindow,
    }));
  } catch {
    /* stay on demo state */
  }
}

export function useSSE() {
  const [state, setState] = useState<SSEState>(createDemoState);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef(0);

  const connect = useCallback(() => {
    const url = `${apiUrl()}/events`;

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.event) {
          case "signal_update": {
            const p = data.payload;
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              signals: { ...prev.signals, [p.signal]: p },
            }));
            break;
          }
          case "presence_update": {
            const p = data.payload;
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              presence: { ...prev.presence, [p.room]: p },
            }));
            break;
          }
          case "location_update": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              location: data.payload,
            }));
            break;
          }
          case "wandering_detected": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              wandering: data.payload,
            }));
            break;
          }
          case "fall_detected": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              fall: data.payload,
            }));
            break;
          }
          case "reasoning_update": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              reasoning: [...prev.reasoning, data.payload].slice(-20),
            }));
            break;
          }
          case "intervention_ack": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              interventionAck: data.payload,
            }));
            break;
          }
          case "connection_window": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              connectionWindow: data.payload,
            }));
            break;
          }
          case "connection_ack": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              connectionAck: data.payload,
            }));
            break;
          }
          case "state_reset": {
            setState((prev) => ({
              ...createEmptyState(),
              connectionWindow: prev.connectionWindow,
              scenarioActive: data.payload.scenario,
              backendConnected: true,
            }));
            break;
          }
          case "ping":
            setState((prev) =>
              prev.backendConnected ? prev : { ...prev, backendConnected: true }
            );
            break;
        }
      } catch {
        /* silent parse error */
      }
    };

    es.onerror = () => {
      es.close();
      setState((prev) => ({ ...prev, backendConnected: false }));
      const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 10000);
      reconnectRef.current++;
      setTimeout(() => connect(), delay);
    };

    es.onopen = () => {
      reconnectRef.current = 0;
      setState((prev) => ({ ...prev, backendConnected: true }));
      void hydrateFromBackend(setState);
    };
  }, []);

  useEffect(() => {
    connect();
    void hydrateFromBackend(setState);

    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [connect]);

  return state;
}
