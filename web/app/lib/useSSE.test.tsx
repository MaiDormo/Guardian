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
});
