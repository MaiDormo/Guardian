import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReasoningPanel from "./ReasoningPanel";
import { reasoningEntry } from "../../tests/fixtures";

describe("ReasoningPanel", () => {
  it("shows example entry and Run Normal Morning when empty", () => {
    const onRun = vi.fn();
    render(
      <ReasoningPanel reasoning={[]} onRunNormalMorning={onRun} sseHealth="connected" />
    );

    expect(screen.getByRole("region", { name: /reasoning console/i })).toBeInTheDocument();
    expect(screen.getByText("Example")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run Normal Morning/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Live · SSE/i);
  });

  it("fires onRunNormalMorning from empty-state CTA", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(<ReasoningPanel reasoning={[]} onRunNormalMorning={onRun} />);

    await user.click(screen.getByRole("button", { name: /Run Normal Morning/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("renders reasoning entries with inferred verdict", () => {
    render(
      <ReasoningPanel
        reasoning={[
          reasoningEntry,
          { ...reasoningEntry, signal: "routine", cosine_distance: 0.3, rationale: "Off routine" },
        ]}
        sseHealth="reconnecting"
      />
    );

    expect(screen.getByText(/Breakfast delayed/i)).toBeInTheDocument();
    expect(screen.getByText(/Off routine/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Reconnecting/i);
  });

  it("shows offline footer when disconnected", () => {
    render(<ReasoningPanel reasoning={[]} sseHealth="disconnected" />);

    expect(screen.getByRole("status")).toHaveTextContent(/Stream offline/i);
  });
});
