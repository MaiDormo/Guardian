import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SignalGrid from "./SignalGrid";
import { makeSignal, reasoningEntry } from "../../tests/fixtures";
import { SIGNAL_NAMES } from "../lib/signals";

describe("SignalGrid", () => {
  it("renders eight vital signal cards", () => {
    const signals = Object.fromEntries(
      SIGNAL_NAMES.map((name) => [name, makeSignal(name, { state: "unknown" })])
    );

    render(<SignalGrid signals={signals} reasoning={[]} />);

    expect(screen.getByRole("region", { name: /vital signals/i })).toBeInTheDocument();
    expect(screen.getByText("8 daily signals")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(8);
  });

  it("passes matching reasoning to signal cards", async () => {
    const user = userEvent.setup();
    const signals = { ate: makeSignal("ate", { state: "amber", reason: "Late breakfast" }) };

    render(<SignalGrid signals={signals} reasoning={[reasoningEntry]} />);

    await user.click(screen.getByRole("button", { name: /Why/i }));
    expect(screen.getByText(reasoningEntry.rationale)).toBeInTheDocument();
  });
});
