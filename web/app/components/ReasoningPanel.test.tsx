import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReasoningPanel from "./ReasoningPanel";
import { reasoningEntry } from "../../tests/fixtures";

describe("ReasoningPanel", () => {
  it("shows example entry and Run Normal Morning when empty", () => {
    const onRun = vi.fn();
    render(
      <ReasoningPanel
        reasoning={[]}
        onRunNormalMorning={onRun}
        sseHealth="connected"
        demoMode
      />
    );

    expect(screen.getByRole("region", { name: /reasoning console/i })).toBeInTheDocument();
    expect(screen.getByText("Example")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Normal Morning/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/On-device reasoning/i);
    expect(screen.queryByText(/<context>/i)).not.toBeInTheDocument();
  });

  it("fires onRunNormalMorning from empty-state CTA", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(<ReasoningPanel reasoning={[]} onRunNormalMorning={onRun} demoMode />);

    await user.click(screen.getByRole("button", { name: /Run Normal Morning/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("renders demo entries with stat line and no context XML", () => {
    render(
      <ReasoningPanel
        reasoning={[
          reasoningEntry,
          { ...reasoningEntry, signal: "routine", cosine_distance: 0.3, rationale: "Off routine" },
        ]}
        sseHealth="reconnecting"
        demoMode
      />
    );

    expect(screen.getByText(/Breakfast delayed/i)).toBeInTheDocument();
    expect(screen.getByText(/Off routine/i)).toBeInTheDocument();
    expect(screen.queryByText(/signal=/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/<context>/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Reconnecting/i);
  });

  it("renders full mode with context XML when demoMode is false", () => {
    render(
      <ReasoningPanel reasoning={[reasoningEntry]} sseHealth="connected" demoMode={false} />
    );

    expect(screen.getByText(/<context>/i)).toBeInTheDocument();
    expect(screen.getByText(/signal=ate/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Live · SSE/i);
  });

  it("caps visible entries to four in demo mode", () => {
    const entries = Array.from({ length: 6 }, (_, i) => ({
      ...reasoningEntry,
      signal: `signal_${i}`,
      updated_at: `2026-06-07T08:${i.toString().padStart(2, "0")}:00Z`,
      rationale: `Entry ${i}`,
    }));

    render(<ReasoningPanel reasoning={entries} demoMode />);

    expect(screen.getByText("Entry 2")).toBeInTheDocument();
    expect(screen.getByText("Entry 5")).toBeInTheDocument();
    expect(screen.queryByText("Entry 0")).not.toBeInTheDocument();
    expect(screen.queryByText("Entry 1")).not.toBeInTheDocument();
  });

  it("shows offline footer when disconnected", () => {
    render(<ReasoningPanel reasoning={[]} sseHealth="disconnected" demoMode />);

    expect(screen.getByRole("status")).toHaveTextContent(/Stream offline/i);
  });

  it("shows red verdict for fall_detected in demo mode", () => {
    render(
      <ReasoningPanel
        reasoning={[
          {
            signal: "fall_detected",
            cosine_distance: null,
            baseline_window_days: null,
            features_considered: ["posture"],
            rationale:
              "Priority interrupt — posture: prone, stationary 12s. Confidence: 0.95.",
            updated_at: "2026-06-07T10:00:00Z",
          },
        ]}
        demoMode
      />
    );

    expect(screen.getByText(/Confidence: 95%/i)).toBeInTheDocument();
  });
});
