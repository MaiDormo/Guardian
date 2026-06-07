import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Header from "./Header";

describe("Header", () => {
  it("renders Ah-Ma identity and location", () => {
    render(<Header />);

    expect(screen.getByRole("heading", { name: "Ah-Ma" })).toBeInTheDocument();
    expect(screen.getByText(/Shenzhen · monitored from Hong Kong/i)).toBeInTheDocument();
    expect(screen.getByAltText("Ah-Ma")).toBeInTheDocument();
  });

  it("shows live SSE status when connected", () => {
    render(<Header backendConnected sseHealth="connected" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Live · SSE/i);
    expect(status).toHaveTextContent(/Running On-Device/i);
  });

  it("shows reconnecting status", () => {
    render(<Header backendConnected={false} sseHealth="reconnecting" />);

    expect(screen.getByRole("status")).toHaveTextContent(/Reconnecting/i);
  });

  it("shows offline status when disconnected", () => {
    render(<Header backendConnected={false} sseHealth="disconnected" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Stream offline/i);
    expect(status).toHaveTextContent(/Demo state only/i);
  });

  it("fires onRunNormalMorning from Run demo button", async () => {
    const onRun = vi.fn();
    const user = userEvent.setup();
    render(
      <Header backendConnected sseHealth="connected" onRunNormalMorning={onRun} />
    );

    await user.click(screen.getByRole("button", { name: /Run demo/i }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it("shows overlay-only dispatch label from status", () => {
    render(
      <Header
        backendConnected
        sseHealth="connected"
        dispatchChannels={{
          primary: "overlay_only",
          wecom_configured: false,
          whatsapp_configured: false,
          auto_dispatch_on_fall: true,
        }}
      />
    );

    expect(screen.getByText(/Overlay-only dispatch/i)).toBeInTheDocument();
    expect(screen.getByText(/fall auto-dispatch on/i)).toBeInTheDocument();
  });

  it("shows WeCom ready when configured", () => {
    render(
      <Header
        backendConnected
        sseHealth="connected"
        dispatchChannels={{
          primary: "wecom",
          wecom_configured: true,
          whatsapp_configured: false,
          auto_dispatch_on_fall: true,
        }}
      />
    );

    expect(screen.getByText(/WeCom dispatch ready/i)).toBeInTheDocument();
  });

  it("disables Run demo while scenario is loading", () => {
    render(
      <Header
        backendConnected
        sseHealth="connected"
        onRunNormalMorning={vi.fn()}
        scenarioLoading
      />
    );

    expect(screen.getByRole("button", { name: /Run demo/i })).toBeDisabled();
  });
});
