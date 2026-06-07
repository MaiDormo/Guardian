import { describe, expect, it } from "vitest";
import {
  formatBaselineComparison,
  formatDistanceFromHome,
  formatPatternMatch,
  formatRouteFamiliarityPercent,
  formatUsualArea,
  humanizeFeatures,
  patternMatchLevel,
} from "./friendlyMetrics";

describe("friendlyMetrics", () => {
  it("maps cosine distance to pattern levels", () => {
    expect(patternMatchLevel(0.04)).toBe("usual");
    expect(patternMatchLevel(0.15)).toBe("drifting");
    expect(patternMatchLevel(0.3)).toBe("unusual");
  });

  it("formats caregiver-facing pattern labels", () => {
    expect(formatPatternMatch(0.04)).toBe("Matches usual pattern");
    expect(formatPatternMatch(0.15)).toBe("Slightly off usual");
    expect(formatPatternMatch(0.3)).toBe("Well off usual");
  });

  it("formats route and location labels", () => {
    expect(formatRouteFamiliarityPercent(0.91)).toBe("91%");
    expect(formatDistanceFromHome(0)).toBe("At home");
    expect(formatDistanceFromHome(120)).toBe("120m from home");
    expect(formatUsualArea(true)).toBe("Usual area");
    expect(formatUsualArea(false)).toBe("Unfamiliar area");
  });

  it("formats baseline and features", () => {
    expect(formatBaselineComparison(14)).toBe("Compared to last 14 days");
    expect(humanizeFeatures(["wake_time", "motion"])).toBe("wake time, motion");
  });
});
