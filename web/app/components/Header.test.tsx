import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Header from "./Header";

describe("Header", () => {
  it("renders masthead with subject, editorial lockup, and location", () => {
    render(<Header />);

    const banner = screen.getByRole("banner");

    expect(within(banner).getByRole("heading", { name: "Ah-Ma" })).toBeInTheDocument();
    expect(within(banner).getByText("Guardian")).toBeInTheDocument();
    expect(within(banner).getByText("On-device care")).toBeInTheDocument();
    expect(within(banner).getByText("Monitored subject")).toBeInTheDocument();
    expect(within(banner).getByText(/Shenzhen · monitored from Hong Kong/i)).toBeInTheDocument();
    expect(within(banner).getByAltText("Ah-Ma")).toBeInTheDocument();
  });

  it("shows live SSE telemetry when connected", () => {
    render(<Header backendConnected sseHealth="connected" />);

    const statuses = screen.getAllByRole("status");
    const telemetry = statuses.find((el) => el.textContent?.includes("Live · SSE"));
    expect(telemetry).toBeDefined();
    expect(telemetry).toHaveTextContent(/Gemma 4/i);
    expect(telemetry).toHaveTextContent(/0 bytes to cloud/i);
  });

  it("shows reconnecting status", () => {
    render(<Header backendConnected={false} sseHealth="reconnecting" />);

    const statuses = screen.getAllByRole("status");
    const telemetry = statuses.find((el) => el.textContent?.includes("Reconnecting"));
    expect(telemetry).toHaveTextContent(/SSE stream retrying/i);
  });

  it("shows offline status when disconnected", () => {
    render(<Header backendConnected={false} sseHealth="disconnected" />);

    const statuses = screen.getAllByRole("status");
    const telemetry = statuses.find((el) => el.textContent?.includes("Stream offline"));
    expect(telemetry).toHaveTextContent(/Demo state only/i);
  });

  it("shows overlay-only dispatch in masthead footer", () => {
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

    const banner = screen.getByRole("banner");
    expect(within(banner).getByText(/Overlay-only dispatch/i)).toBeInTheDocument();
    expect(within(banner).getByText(/fall auto-dispatch on/i)).toBeInTheDocument();
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
});
