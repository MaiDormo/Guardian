import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StreamOfflineBanner from "./StreamOfflineBanner";

describe("StreamOfflineBanner", () => {
  it("renders nothing when connected", () => {
    const { container } = render(
      <StreamOfflineBanner sseHealth="connected" backendConnected />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows offline alert when disconnected", () => {
    render(<StreamOfflineBanner sseHealth="disconnected" backendConnected={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Live stream offline/i);
    expect(screen.getByText(/docker compose up/i)).toBeInTheDocument();
  });

  it("shows reconnecting message while retrying", () => {
    render(<StreamOfflineBanner sseHealth="reconnecting" backendConnected={false} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/Reconnecting to backend/i);
  });
});
