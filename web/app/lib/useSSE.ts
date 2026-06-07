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
import { emptySignalState } from "./signals";
import { apiUrl } from "./api";

/** Pitch-stable connection window — matches backend stub / seed design. */
export const DEMO_CONNECTION_WINDOW: ConnectionWindowPayload = {
  best_window: "15:00-16:00",
  best_hour: 15,
  overlap_with_child: true,
  confidence: "moderate",
  evidence: {
    presence_days: null,
    baseline_days: 14,
    avg_clarity: null,
    positivity_rate: null,
  },
  rationale:
    "Ah-Ma is typically calm and present in the early afternoon. You are free at this time.",
  updated_at: "1970-01-01T00:00:00.000Z",
};

export type SSEHealth = "connected" | "reconnecting" | "disconnected";

export type DispatchPrimary = "wecom" | "whatsapp" | "overlay_only";

export interface DispatchChannels {
  primary: DispatchPrimary;
  wecom_configured: boolean;
  whatsapp_configured: boolean;
  auto_dispatch_on_fall: boolean;
}

export interface SSEState {
  signals: Record<string, SignalStateData>;
  presence: Record<string, PresencePayload>;
  wandering: WanderingPayload | null;
  fall: FallPayload | null;
  reasoning: ReasoningPayload[];
  interventionAck: InterventionAckPayload | null;
  connectionWindow: ConnectionWindowPayload | null;
  connectionWindowLoading: boolean;
  connectionAck: ConnectionAckPayload | null;
  location: LocationUpdatePayload | null;
  scenarioActive: string | null;
  backendConnected: boolean;
  sseHealth: SSEHealth;
  dispatchChannels: DispatchChannels | null;
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
    connectionWindowLoading: false,
    connectionAck: null,
    location: null,
    scenarioActive: null,
    backendConnected: false,
    sseHealth: "disconnected",
    dispatchChannels: null,
  };
}

/** Initial state — blank signals until a scenario streams data in. */
function createConnectingState(): SSEState {
  return {
    ...createEmptyState(),
    sseHealth: "reconnecting",
    connectionWindow: DEMO_CONNECTION_WINDOW,
    connectionWindowLoading: false,
  };
}

/** Keep one reasoning row per signal — latest assessment wins. */
export function upsertReasoning(
  prev: ReasoningPayload[],
  entry: ReasoningPayload
): ReasoningPayload[] {
  const idx = prev.findIndex((r) => r.signal === entry.signal);
  if (idx === -1) return [...prev, entry].slice(-20);
  const next = [...prev];
  next[idx] = entry;
  return next;
}

async function hydrateFromBackend(
  setState: Dispatch<SetStateAction<SSEState>>
): Promise<void> {
  const base = apiUrl();
  setState((prev) => ({ ...prev, connectionWindowLoading: true }));
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
      sseHealth: "connected",
      connectionWindowLoading: false,
      // Signals/reasoning come only from live SSE scenario events — not /status
      // (backend may still hold the last run in memory for operator curl checks).
      connectionWindow: connection?.best_window
        ? connection
        : prev.connectionWindow ?? DEMO_CONNECTION_WINDOW,
      dispatchChannels: status.dispatch ?? prev.dispatchChannels,
    }));
  } catch {
    setState((prev) => ({
      ...prev,
      connectionWindowLoading: false,
      sseHealth: prev.sseHealth === "connected" ? "connected" : "disconnected",
    }));
  }
}

export function useSSE() {
  const [state, setState] = useState<SSEState>(createConnectingState);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef(0);
  const connect = useCallback(async () => {
    const url = `${apiUrl()}/events`;

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(url);
    esRef.current = es;

    setState((prev) => ({
      ...prev,
      sseHealth: "reconnecting",
    }));

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.event) {
          case "signal_update": {
            const p = data.payload;
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              signals: { ...prev.signals, [p.signal]: p },
            }));
            break;
          }
          case "presence_update": {
            const p = data.payload;
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              presence: { ...prev.presence, [p.room]: p },
            }));
            break;
          }
          case "location_update": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              location: data.payload,
            }));
            break;
          }
          case "wandering_detected": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              wandering: data.payload,
            }));
            break;
          }
          case "fall_detected": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              fall: data.payload,
            }));
            break;
          }
          case "reasoning_update": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              reasoning: upsertReasoning(prev.reasoning, data.payload),
            }));
            break;
          }
          case "intervention_ack": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              interventionAck: data.payload,
            }));
            break;
          }
          case "connection_window": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              connectionWindow: data.payload,
              connectionWindowLoading: false,
            }));
            break;
          }
          case "connection_ack": {
            setState((prev) => ({
              ...prev,
              backendConnected: true,
              sseHealth: "connected",
              connectionAck: data.payload,
            }));
            break;
          }
          case "state_reset": {
            setState((prev) => ({
              ...createEmptyState(),
              connectionWindow: prev.connectionWindow ?? DEMO_CONNECTION_WINDOW,
              scenarioActive: data.payload.scenario,
              backendConnected: true,
              sseHealth: "connected",
            }));
            break;
          }
          case "ping":
            setState((prev) =>
              prev.backendConnected
                ? prev
                : { ...prev, backendConnected: true, sseHealth: "connected" }
            );
            break;
        }
      } catch {
        /* silent parse error */
      }
    };

    es.onerror = () => {
      es.close();
      setState((prev) => ({
        ...prev,
        backendConnected: false,
        sseHealth: "reconnecting",
      }));
      const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 10000);
      reconnectRef.current++;
      setTimeout(() => connect(), delay);
    };

    es.onopen = () => {
      reconnectRef.current = 0;
      setState((prev) => ({
        ...prev,
        backendConnected: true,
        sseHealth: "connected",
      }));
      void hydrateFromBackend(setState);
    };
  }, []);

  useEffect(() => {
    void connect();

    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [connect]);

  return state;
}
