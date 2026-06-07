import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScenarioPlayer, { triggerScenario } from "./ScenarioPlayer";
import * as scenario from "../lib/scenario";

describe("ScenarioPlayer", () => {
  it("renders all three demo scenarios", () => {
    render(
      <ScenarioPlayer onScenarioStart={vi.fn()} loading={null} onLoadingChange={vi.fn()} />
    );

    expect(screen.getByRole("group", { name: /demo scenarios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Normal Morning/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /7-Day Trend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fall Override/i })).toBeInTheDocument();
  });

  it("disables all buttons while a scenario is loading", () => {
    render(
      <ScenarioPlayer onScenarioStart={vi.fn()} loading="normal" onLoadingChange={vi.fn()} />
    );

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: /Normal Morning/i })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("calls onScenarioStart and clears loading after run", async () => {
    vi.spyOn(scenario, "runScenario").mockResolvedValue(undefined);
    const onStart = vi.fn();
    const onLoadingChange = vi.fn();

    render(
      <ScenarioPlayer
        onScenarioStart={onStart}
        loading={null}
        onLoadingChange={onLoadingChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Normal Morning/i }));

    expect(onStart).toHaveBeenCalled();
    expect(onLoadingChange).toHaveBeenCalledWith("normal");

    await waitFor(() => {
      expect(onLoadingChange).toHaveBeenCalledWith(null);
    });
  });
});

describe("triggerScenario", () => {
  it("invokes callbacks in order", async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    const onStart = () => order.push("start");
    const onLoading = (name: string | null) => order.push(`loading:${name}`);

    const promise = triggerScenario("fall", onStart, onLoading);
    await promise;
    vi.advanceTimersByTime(500);

    expect(order[0]).toBe("loading:fall");
    expect(order[1]).toBe("start");
    expect(order).toContain("loading:null");
    vi.useRealTimers();
  });
});
