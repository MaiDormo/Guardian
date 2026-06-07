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

  it("shows friendly helper_present labels without windo truncation", () => {
    render(
      <SignalCard
        data={makeSignal("helper_present", {
          reason: "Second presence detected in helper window",
          state: "green",
        })}
      />
    );

    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByText("Helper here during usual window")).toBeInTheDocument();
    expect(screen.queryByText(/helper windo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Second presence detect/i)).not.toBeInTheDocument();
  });

  it("shows friendly took_meds labels without repeating dispenser jargon on expand", async () => {
    const user = userEvent.setup();
    render(
      <SignalCard
        data={makeSignal("took_meds", {
          reason: "Dispenser opened — compartment morning",
          state: "green",
        })}
      />
    );

    expect(screen.getByText("Morning dose")).toBeInTheDocument();
    expect(screen.getByText("Morning compartment · on schedule")).toBeInTheDocument();
    expect(screen.queryByText(/Dispenser opened/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Why/i }));
    expect(screen.queryByText(/Dispenser opened/i)).not.toBeInTheDocument();
  });

  it("shows caregiver-friendly labels for Normal Morning location and routine", () => {
    render(
      <SignalCard
        data={makeSignal("location", { reason: "Density score 0.91", state: "green" })}
      />
    );
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("91% familiar with usual route")).toBeInTheDocument();
    expect(screen.queryByText(/Density score/i)).not.toBeInTheDocument();

    render(
      <SignalCard
        data={makeSignal("routine", {
          reason: "Cosine distance 0.04",
          cosine_distance: 0.04,
          state: "green",
        })}
      />
    );
    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Matches usual pattern")).toBeInTheDocument();
    expect(screen.queryByText(/Cosine distance/i)).not.toBeInTheDocument();
  });
});
