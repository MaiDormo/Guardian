import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import LocationMap from "./LocationMap";
import { locationNormal, wanderingPayload } from "../../tests/fixtures";

describe("LocationMap", () => {
  it("shows Daily Route Check with usual routine status", () => {
    const { container } = render(<LocationMap location={locationNormal} wandering={null} />);

    expect(screen.getByRole("region", { name: /daily route check/i })).toBeInTheDocument();
    expect(screen.getByText("Daily Route Check")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Usual routine");
    expect(screen.getByText(/At home — within usual routine/i)).toBeInTheDocument();
    expect(screen.getByText("91% match to usual pattern")).toBeInTheDocument();
    expect(container.querySelector(".animate-dash-flow")).toBeNull();
  });

  it("shows wandering state with minutes outside route", () => {
    const { container } = render(
      <LocationMap location={locationNormal} wandering={wanderingPayload} />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Outside route");
    expect(screen.queryByText(/Following usual routine/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /daily route check/i })
    ).toHaveTextContent(/Outside usual route/i);
    expect(screen.getByText(/18 min outside usual route/i)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Anomalous route outside/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/red = today's path/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(container.querySelector(".animate-path-reveal")).not.toBeNull();
  });

  it("uses wandering score when location is null during alert", () => {
    render(<LocationMap location={null} wandering={wanderingPayload} />);

    expect(screen.getByText("32% match to usual pattern")).toBeInTheDocument();
    expect(screen.queryByText(/Learning usual pattern/i)).not.toBeInTheDocument();
  });

  it("shows legend for green loop and occasional visit", () => {
    render(<LocationMap location={locationNormal} wandering={null} />);

    expect(screen.getByText(/Green loop = usual week/i)).toBeInTheDocument();
    expect(screen.getByText(/grey dash = occasional visit/i)).toBeInTheDocument();
  });

  it("toggles raw details panel with wandering fallbacks", async () => {
    const user = userEvent.setup();
    render(<LocationMap location={null} wandering={wanderingPayload} />);

    await user.click(screen.getByRole("button", { name: /Details/i }));
    expect(screen.getByText("Route familiarity")).toBeInTheDocument();
    expect(screen.getByText("32%")).toBeInTheDocument();
    expect(screen.getByText("Unfamiliar area")).toBeInTheDocument();
  });

  it("shows learning message only when both location and wandering are null", () => {
    render(<LocationMap location={null} wandering={null} />);

    expect(screen.getByText(/Learning usual pattern/i)).toBeInTheDocument();
  });
});
