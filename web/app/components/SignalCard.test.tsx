import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SignalCard from "./SignalCard";
import { makeSignal, reasoningEntry } from "../../tests/fixtures";

describe("SignalCard", () => {
  it("shows human-readable value with accessible label", () => {
    render(
      <SignalCard
        data={makeSignal("woke_up", { reason: "Woke at 07:15", state: "green" })}
      />
    );

    expect(screen.getByRole("article", { name: /Woke Up: OK, 07:15 AM/i })).toBeInTheDocument();
    expect(screen.getByText("07:15 AM")).toBeInTheDocument();
  });

  it("shows awaiting baseline for unknown state", () => {
    render(<SignalCard data={makeSignal("ate", { state: "unknown" })} />);

    expect(screen.getByText("Awaiting baseline…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Why/i })).not.toBeInTheDocument();
  });

  it("shows amber badge and warn styling context", () => {
    render(
      <SignalCard
        data={makeSignal("ate", { state: "amber", reason: "Light breakfast" })}
      />
    );

    expect(screen.getByRole("article", { name: /Ate: Amber/i })).toBeInTheDocument();
    expect(screen.getByText("Amber")).toBeInTheDocument();
  });

  it("expands reasoning on Why click", async () => {
    const user = userEvent.setup();
    render(
      <SignalCard
        data={makeSignal("ate", { state: "amber", reason: "Light breakfast" })}
        reasoning={reasoningEntry}
      />
    );

    await user.click(screen.getByRole("button", { name: /Why/i }));
    expect(screen.getByText(reasoningEntry.rationale)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows cosine subtitle from data", () => {
    render(
      <SignalCard
        data={makeSignal("routine", { cosine_distance: 0.15, state: "amber" })}
      />
    );

    expect(screen.getByText("Slightly off usual")).toBeInTheDocument();
  });
});
