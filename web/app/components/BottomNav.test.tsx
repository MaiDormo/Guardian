import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BottomNav from "./BottomNav";

describe("BottomNav", () => {
  it("marks Home as current page", () => {
    render(<BottomNav />);

    const home = screen.getByRole("button", { name: "Home" });
    expect(home).toHaveAttribute("aria-current", "page");
    expect(home).not.toBeDisabled();
  });

  it("disables coming-soon tabs with tabIndex -1", () => {
    render(<BottomNav />);

    for (const label of ["Timeline", "Sensors", "Profile"]) {
      const btn = screen.getByRole("button", { name: `${label} (coming soon)` });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("tabindex", "-1");
    }
  });
});
