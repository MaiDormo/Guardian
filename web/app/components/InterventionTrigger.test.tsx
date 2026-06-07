import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InterventionTrigger from "./InterventionTrigger";

const ack = {
  dispatched: true,
  channel: "WeCom",
  message_preview: "Care team notified",
  updated_at: "2026-06-07T10:00:00Z",
};

describe("InterventionTrigger", () => {
  it("shows recommended status when intervention is recommended", () => {
    render(
      <InterventionTrigger
        interventionAck={null}
        scenarioActive="trend_7day"
        interventionRecommended
        className="flex"
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(/intervention recommended/i);
  });

  it("does not show recommended status when trend is active but no red signals", () => {
    render(
      <InterventionTrigger
        interventionAck={null}
        scenarioActive="trend_7day"
        interventionRecommended={false}
        className="flex"
      />
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dispatches via onDispatch callback", async () => {
    const onDispatch = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <InterventionTrigger
        interventionAck={null}
        scenarioActive={null}
        interventionRecommended
        onDispatch={onDispatch}
        className="flex"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Dispatch Local Emergency Care/i })
    );

    await waitFor(() => expect(onDispatch).toHaveBeenCalledOnce());
  });

  it("shows dispatching overlay when clicked without callback", async () => {
    const user = userEvent.setup();

    render(
      <InterventionTrigger
        interventionAck={null}
        scenarioActive={null}
        interventionRecommended
        className="flex"
      />
    );

    await user.click(
      screen.getByRole("button", { name: /Dispatch Local Emergency Care/i })
    );

    expect(screen.getByText(/Dispatching alert/i)).toBeInTheDocument();
  });

  it("shows confirmation overlay when interventionAck arrives", () => {
    render(
      <InterventionTrigger
        interventionAck={ack}
        scenarioActive={null}
        interventionRecommended
        className="flex"
      />
    );

    expect(screen.getByText(/Alert dispatched/i)).toBeInTheDocument();
    expect(screen.getByText(ack.message_preview)).toBeInTheDocument();
    expect(screen.getByText(/via WeCom/i)).toBeInTheDocument();
  });
});
