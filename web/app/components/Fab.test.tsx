import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Fab from "./Fab";

const ack = {
  dispatched: true,
  channel: "WeCom",
  message_preview: "Shenzhen team on the way",
  updated_at: "2026-06-07T10:00:00Z",
};

describe("Fab", () => {
  it("renders dispatch button when visible and not dispatched", () => {
    render(
      <Fab onDispatch={vi.fn()} dispatching={false} dispatched={false} interventionAck={null} />
    );

    expect(screen.getByRole("button", { name: /Dispatch emergency care/i })).toBeInTheDocument();
  });

  it("hides when not visible and no ack", () => {
    const { container } = render(
      <Fab
        onDispatch={vi.fn()}
        dispatching={false}
        dispatched={false}
        interventionAck={null}
        visible={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows ack toast when dispatched", () => {
    render(
      <Fab onDispatch={vi.fn()} dispatching={false} dispatched interventionAck={ack} />
    );

    expect(screen.getByRole("status")).toHaveTextContent(/Alert dispatched/i);
    expect(screen.getByText(ack.message_preview)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dispatch emergency care/i })).not.toBeInTheDocument();
  });

  it("calls onDispatch when FAB clicked", async () => {
    const onDispatch = vi.fn();
    const user = userEvent.setup();

    render(
      <Fab onDispatch={onDispatch} dispatching={false} dispatched={false} interventionAck={null} />
    );

    await user.click(screen.getByRole("button", { name: /Dispatch emergency care/i }));
    expect(onDispatch).toHaveBeenCalledOnce();
  });
});
