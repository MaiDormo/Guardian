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

  it("hides coming-soon tabs from the navigation", () => {
    render(<BottomNav />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Timeline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sensors/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Profile/i })).not.toBeInTheDocument();
  });
});
