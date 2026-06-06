"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "./types";
import { SIGNAL_NAMES } from "./signals";

export interface SSEState {
  signals: Record<string, SignalStateData>;
  presence: Record<string, PresencePayload>;
  wandering: WanderingPayload | null;
  fall: FallPayload | null;
  reasoning: ReasoningPayload[];
  interventionAck: InterventionAckPayload | null;
  location: LocationUpdatePayload | null;
  scenarioActive: string | null;
}

function demoInitialState(): SSEState {
  const signals: Record<string, SignalStateData> = {};
  for (const name of SIGNAL_NAMES) {
    signals[name] = {
      signal: name,
      state: "green" as SignalState,
      reason: "",
      cosine_distance: 0.15,
      updated_at: new Date().toISOString(),
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
  const loc: LocationUpdatePayload = {
    trajectory_density_score: 10,
    baseline_cluster_match: true,
    distance_from_home_m: 0,
    updated_at: new Date().toISOString(),
  };
  return {
    signals,
    presence: {},
    wandering: null,
    fall: null,
    reasoning: [],
    interventionAck: null,
    location: loc,
    scenarioActive: null,
  };
}

const INITIAL_STATE = demoInitialState();

export function useSSE() {
  const [state, setState] = useState<SSEState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);
  const reconnectRef = useRef(0);

  const connect = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = `${apiUrl}/events`;

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
              signals: { ...prev.signals, [p.signal]: p },
            }));
            break;
          }
          case "presence_update": {
            const p = data.payload;
            setState((prev) => ({
              ...prev,
              presence: { ...prev.presence, [p.room]: p },
            }));
            break;
          }
          case "location_update": {
            setState((prev) => ({ ...prev, location: data.payload }));
            break;
          }
          case "wandering_detected": {
            setState((prev) => ({ ...prev, wandering: data.payload }));
            break;
          }
          case "fall_detected": {
            setState((prev) => ({ ...prev, fall: data.payload }));
            break;
          }
          case "reasoning_update": {
            setState((prev) => ({
              ...prev,
              reasoning: [...prev.reasoning, data.payload].slice(-20),
            }));
            break;
          }
          case "intervention_ack": {
            setState((prev) => ({ ...prev, interventionAck: data.payload }));
            break;
          }
          case "state_reset": {
            setState({
              ...INITIAL_STATE,
              scenarioActive: data.payload.scenario,
            });
            break;
          }
          case "ping":
            break;
        }
      } catch (e) {
        /* silent parse error */
      }
    };

    es.onerror = () => {
      es.close();
      const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 10000);
      reconnectRef.current++;
      setTimeout(() => connect(), delay);
    };

    es.onopen = () => {
      reconnectRef.current = 0;
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [connect]);

  return state;
}
