import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ZoneMap from "./ZoneMap";
import { makePresence } from "../../tests/fixtures";

describe("ZoneMap", () => {
  it("renders all four rooms with empty status by default", () => {
    render(<ZoneMap presence={{}} />);

    expect(screen.getByRole("region", { name: /abstract zone map/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Bedroom: empty")).toBeInTheDocument();
    expect(screen.getByLabelText("Bathroom: empty")).toBeInTheDocument();
    expect(screen.getByLabelText("Living Room: empty")).toBeInTheDocument();
    expect(screen.getByLabelText("Kitchen: empty")).toBeInTheDocument();
  });

  it("shows occupied status for active rooms", () => {
    render(
      <ZoneMap
        presence={{
          kitchen: makePresence("kitchen", true),
          bedroom: makePresence("bedroom", false),
        }}
      />
    );

    expect(screen.getByLabelText("Kitchen: occupied")).toBeInTheDocument();
    expect(screen.getByLabelText("Bedroom: empty")).toBeInTheDocument();
  });

  it("shows fall detected status", () => {
    render(
      <ZoneMap
        presence={{
          bathroom: makePresence("bathroom", true, true),
        }}
      />
    );

    expect(screen.getByLabelText("Bathroom: fall detected")).toBeInTheDocument();
  });
});
