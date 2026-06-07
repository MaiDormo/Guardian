import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ConnectionCard from "./ConnectionCard";
import { connectionAck, connectionWindow } from "../../tests/fixtures";

describe("ConnectionCard", () => {
  it("renders loading skeleton when loading without window", () => {
    render(<ConnectionCard window={null} connectionAck={null} loading />);

    const section = screen.getByRole("region", { name: /optimal connection window/i });
    expect(section).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Computing optimal call window/i)).toBeInTheDocument();
  });

  it("renders empty state prompting Normal Morning", () => {
    render(<ConnectionCard window={null} connectionAck={null} />);

    expect(screen.getByText(/Run/)).toBeInTheDocument();
    expect(screen.getByText(/Normal Morning/)).toBeInTheDocument();
    expect(screen.getByText(/14-day baseline/i)).toBeInTheDocument();
  });

  it("renders loaded window with clarity and overlap copy", () => {
    render(<ConnectionCard window={connectionWindow} connectionAck={null} />);

    expect(screen.getByText("2:00 – 3:30 PM")).toBeInTheDocument();
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(/reliably calm and clear-spoken/i)).toBeInTheDocument();
    expect(screen.getByText(/12\/14d baseline/i)).toBeInTheDocument();
  });

  it("shows schedule mismatch when no child overlap", () => {
    render(
      <ConnectionCard
        window={{ ...connectionWindow, overlap_with_child: false }}
        connectionAck={null}
      />
    );

    expect(screen.getByText(/doesn't fully overlap your schedule/i)).toBeInTheDocument();
  });

  it("sends call nudge and shows sent state", async () => {
    const user = userEvent.setup();
    render(<ConnectionCard window={connectionWindow} connectionAck={connectionAck} />);

    await user.click(screen.getByRole("button", { name: /Send call nudge/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nudge sent/i })).toBeDisabled();
    });
  });

  it("expands rationale on Why this window click", async () => {
    const user = userEvent.setup();
    render(<ConnectionCard window={connectionWindow} connectionAck={null} />);

    await user.click(screen.getByRole("button", { name: /Why this window/i }));
    expect(screen.getByText(connectionWindow.rationale)).toBeInTheDocument();
  });
});
