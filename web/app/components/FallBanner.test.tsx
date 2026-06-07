import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FallBanner from "./FallBanner";
import { fallPayload } from "../../tests/fixtures";

describe("FallBanner", () => {
  it("renders nothing when fall is null", () => {
    const { container } = render(<FallBanner fall={null} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders role=alert with fall details", () => {
    render(<FallBanner fall={fallPayload} onDismiss={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText(/Fall Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Bathroom/i)).toBeInTheDocument();
    expect(screen.getByText(/92% confidence/i)).toBeInTheDocument();
  });

  it("shows auto-dispatch message when autoDispatched", () => {
    render(<FallBanner fall={fallPayload} onDismiss={vi.fn()} autoDispatched />);

    expect(
      screen.getByText(/Emergency alert auto-dispatched to care network/i)
    ).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<FallBanner fall={fallPayload} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: /Dismiss fall alert/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
