import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API } from "../../tests/mocks/handlers";
import { server } from "../../tests/mocks/server";
import { MockEventSource } from "../../tests/mocks/mock-event-source";
import { useSSE } from "./useSSE";
import { makeSignal } from "../../tests/fixtures";

describe("useSSE", () => {
  beforeEach(() => {
    MockEventSource.reset();
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in reconnecting state with connectionWindowLoading true", () => {
    const { result } = renderHook(() => useSSE());

    expect(result.current.sseHealth).toBe("reconnecting");
    expect(result.current.connectionWindowLoading).toBe(true);
    expect(MockEventSource.lastInstance?.url).toBe(`${API}/events`);
  });

  it("hydrates from backend once on SSE open", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();

    await waitFor(() => {
      expect(result.current.sseHealth).toBe("connected");
      expect(result.current.connectionWindowLoading).toBe(false);
    });

    expect(result.current.signals.woke_up?.state).toBe("green");
    expect(result.current.connectionWindow?.best_window).toBe("2:00 – 3:30 PM");
    expect(result.current.dispatchChannels?.primary).toBe("overlay_only");
    expect(result.current.dispatchChannels?.auto_dispatch_on_fall).toBe(true);
  });

  it("applies signal_update SSE events", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();

    await waitFor(() => expect(result.current.sseHealth).toBe("connected"));

    MockEventSource.lastInstance?.simulateMessage({
      event: "signal_update",
      payload: makeSignal("routine", { state: "red", reason: "Off routine" }),
    });

    await waitFor(() => {
      expect(result.current.signals.routine?.state).toBe("red");
    });
  });

  it("applies connection_window SSE event and clears loading", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();

    await waitFor(() => expect(result.current.sseHealth).toBe("connected"));

    MockEventSource.lastInstance?.simulateMessage({
      event: "connection_window",
      payload: {
        best_window: "4:00 PM",
        best_hour: 16,
        overlap_with_child: false,
        confidence: "moderate",
        evidence: {
          presence_days: 10,
          baseline_days: 14,
          avg_clarity: 0.8,
          positivity_rate: 0.6,
        },
        rationale: "Late afternoon window",
        updated_at: "2026-06-07T16:00:00Z",
      },
    });

    await waitFor(() => {
      expect(result.current.connectionWindow?.best_window).toBe("4:00 PM");
      expect(result.current.connectionWindowLoading).toBe(false);
    });
  });

  it("resets state on state_reset preserving connection window", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();

    await waitFor(() => expect(result.current.connectionWindow).not.toBeNull());

    MockEventSource.lastInstance?.simulateMessage({
      event: "state_reset",
      payload: { scenario: "normal", updated_at: "2026-06-07T08:00:00Z" },
    });

    await waitFor(() => {
      expect(result.current.scenarioActive).toBe("normal");
      expect(result.current.signals.woke_up?.state).toBe("unknown");
      expect(result.current.connectionWindow?.best_window).toBe("2:00 – 3:30 PM");
    });
  });

  it("marks backend disconnected on SSE error", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateError();

    await vi.waitFor(() => {
      expect(result.current.backendConnected).toBe(false);
      expect(result.current.sseHealth).toBe("reconnecting");
    });

    expect(MockEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(2);
    vi.useRealTimers();
  });

  it("clears connectionWindowLoading when hydrate fails", async () => {
    server.use(http.get(`${API}/status`, () => HttpResponse.error()));

    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();

    await waitFor(() => {
      expect(result.current.connectionWindowLoading).toBe(false);
    });
  });

  it("applies presence_update fall_detected and wandering_detected events", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();
    await waitFor(() => expect(result.current.sseHealth).toBe("connected"));

    MockEventSource.lastInstance?.simulateMessage({
      event: "presence_update",
      payload: {
        room: "bathroom",
        occupied: true,
        fall: true,
        updated_at: "2026-06-07T10:00:00Z",
      },
    });
    MockEventSource.lastInstance?.simulateMessage({
      event: "fall_detected",
      payload: {
        room: "bathroom",
        posture: "lying",
        stationary_s: 30,
        confidence: 0.9,
        updated_at: "2026-06-07T10:00:00Z",
      },
    });
    MockEventSource.lastInstance?.simulateMessage({
      event: "wandering_detected",
      payload: {
        trajectory_density_score: 0.2,
        baseline_cluster_match: false,
        minutes_outside_baseline_footprint: 12,
        updated_at: "2026-06-07T11:00:00Z",
      },
    });

    await waitFor(() => {
      expect(result.current.presence.bathroom?.fall).toBe(true);
      expect(result.current.fall?.room).toBe("bathroom");
      expect(result.current.wandering?.minutes_outside_baseline_footprint).toBe(12);
    });
  });

  it("upserts reasoning by signal instead of duplicating rows", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();
    await waitFor(() => expect(result.current.sseHealth).toBe("connected"));

    const base = {
      cosine_distance: 0.38,
      baseline_window_days: 14,
      features_considered: ["speech_rate_wpm"],
      updated_at: "2026-06-07T10:00:00Z",
    };

    MockEventSource.lastInstance?.simulateMessage({
      event: "reasoning_update",
      payload: {
        signal: "voice_checkin",
        ...base,
        rationale: "Day 7 voice check-in: first",
      },
    });
    MockEventSource.lastInstance?.simulateMessage({
      event: "reasoning_update",
      payload: {
        signal: "voice_checkin",
        ...base,
        rationale: "Day 7 voice check-in: updated",
        updated_at: "2026-06-07T10:01:00Z",
      },
    });

    await waitFor(() => {
      expect(result.current.reasoning).toHaveLength(1);
      expect(result.current.reasoning[0]?.rationale).toContain("updated");
    });
  });

  it("appends reasoning and handles intervention_ack", async () => {
    const { result } = renderHook(() => useSSE());
    MockEventSource.lastInstance?.simulateOpen();
    await waitFor(() => expect(result.current.sseHealth).toBe("connected"));

    MockEventSource.lastInstance?.simulateMessage({
      event: "reasoning_update",
      payload: {
        signal: "ate",
        cosine_distance: 0.1,
        baseline_window_days: 14,
        features_considered: ["meal_time"],
        rationale: "On time",
        updated_at: "2026-06-07T08:00:00Z",
      },
    });
    MockEventSource.lastInstance?.simulateMessage({
      event: "intervention_ack",
      payload: {
        dispatched: true,
        channel: "WeCom",
        message_preview: "Alert sent",
        updated_at: "2026-06-07T10:00:00Z",
      },
    });

    await waitFor(() => {
      expect(result.current.reasoning).toHaveLength(1);
      expect(result.current.interventionAck?.message_preview).toBe("Alert sent");
    });
  });
});
