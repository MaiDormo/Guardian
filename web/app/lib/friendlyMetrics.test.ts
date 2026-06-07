import { describe, expect, it } from "vitest";
import {
  formatBaselineComparison,
  formatDistanceFromHome,
  formatHelperPresentHeadline,
  formatHelperPresentSubtitle,
  formatLocationHeadline,
  formatLocationSubtitle,
  formatPatternMatch,
  formatReasoningStatLine,
  formatRouteFamiliarityPercent,
  formatRoutineHeadline,
  formatTookMedsHeadline,
  formatTookMedsSubtitle,
  formatUsualArea,
  formatVoiceHeadline,
  formatVoiceSubtitle,
  formatWokeUpSubtitle,
  formatWokeUpTime,
  humanizeFeatures,
  isTechnicalReason,
  parseClarityScore,
  parseDensityScore,
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

  it("parses backend jargon from reason strings", () => {
    expect(parseDensityScore("Density score 0.91")).toBe(0.91);
    expect(parseClarityScore("Speech 105 wpm, clarity 0.68")).toBe(0.68);
    expect(isTechnicalReason("Density score 0.91")).toBe(true);
    expect(isTechnicalReason("Cosine distance 0.04")).toBe(true);
    expect(isTechnicalReason("Breakfast delayed")).toBe(false);
  });

  it("formats signal card headlines and subtitles", () => {
    expect(formatLocationHeadline("green", "Density score 0.91")).toBe("91%");
    expect(formatLocationSubtitle("green", "Density score 0.91")).toBe(
      "91% familiar with usual route"
    );
    expect(formatRoutineHeadline("green")).toBe("On track");
    expect(formatVoiceHeadline("green")).toBe("Clear");
    expect(formatVoiceSubtitle("green", "Speech 138 wpm, clarity 0.87")).toBe(
      "87% voice clarity · sounds like her usual self"
    );
    expect(formatWokeUpTime("Bedroom motion at 07:23")).toBe("07:23 AM");
    expect(formatWokeUpTime("Bedroom motion at 08:xx")).toBe("8 AM");
    expect(formatWokeUpSubtitle("Bedroom motion at 08:xx")).toBe(
      "Morning bedroom activity"
    );
    expect(
      formatTookMedsHeadline("green", "Dispenser opened — compartment morning")
    ).toBe("Morning dose");
    expect(
      formatTookMedsSubtitle("green", "Dispenser opened — compartment morning")
    ).toBe("Morning compartment · on schedule");
    expect(formatTookMedsHeadline("red", "Dispenser missed — 120 min overdue")).toBe(
      "Missed"
    );
    expect(formatTookMedsSubtitle("red", "Dispenser missed — 120 min overdue")).toBe(
      "120 min overdue"
    );
    expect(
      formatHelperPresentHeadline("green", "Second presence detected in helper window")
    ).toBe("Present");
    expect(
      formatHelperPresentSubtitle("green", "Second presence detected in helper window")
    ).toBe("Helper here during usual window");
  });

  it("formats reasoning console stat lines from agent.py rationales", () => {
    expect(
      formatReasoningStatLine({
        signal: "routine",
        cosine_distance: 0.04,
        baseline_window_days: 14,
        rationale:
          "All signals nominal. Morning routine follows 30-day baseline precisely. " +
          "Bedroom exit 07:23, kitchen presence 07:52, dispenser opened 08:10. " +
          "Baseline deviation: 0.04 — well within normal variance.",
      })
    ).toBe("Baseline deviation: 0.04 — well within normal variance");

    expect(
      formatReasoningStatLine({
        signal: "location",
        cosine_distance: 0.04,
        baseline_window_days: 14,
        rationale:
          "GPS trajectory within established spatial footprint. " +
          "Density score 0.91 — well above 0.15 threshold.",
      })
    ).toBe("91% route familiarity");

    expect(
      formatReasoningStatLine({
        signal: "voice_checkin",
        cosine_distance: 0.12,
        baseline_window_days: 14,
        rationale:
          "Day 5: clarity score 0.68 (baseline 0.87, −22%). " +
          "Response latency 2.9s (baseline 1.2s, +142%). Mild deviation — monitoring closely.",
      })
    ).toBe("68% voice clarity");

    expect(
      formatReasoningStatLine({
        signal: "voice_checkin",
        cosine_distance: 0.38,
        baseline_window_days: 14,
        rationale:
          "Day 7 voice check-in: speech rate 89 WPM (baseline 138 WPM, −35.5%). " +
          "Clarity score 0.61 (baseline 0.87). Active confusion markers detected.",
      })
    ).toBe("61% voice clarity");

    expect(
      formatReasoningStatLine({
        signal: "connection_window",
        cosine_distance: null,
        baseline_window_days: 14,
        rationale:
          "Ah-Ma's afternoons follow a stable, calm pattern — living-room presence " +
          "15:00–16:00 across 12 of the last 14 days. 15:00 is the optimal moment to connect.",
      })
    ).toBe("Best window: 15:00–16:00");

    expect(
      formatReasoningStatLine({
        signal: "fall_detected",
        cosine_distance: null,
        baseline_window_days: null,
        rationale:
          "Priority interrupt — mmWave MR60FDA1, posture: prone, stationary 12s. " +
          "Confidence: 0.95. Bypassed agent loop. Immediate intervention required.",
      })
    ).toBe("Confidence: 95% · prone · 12s stationary");

    expect(
      formatReasoningStatLine({
        signal: "routine",
        cosine_distance: 0.38,
        baseline_window_days: 14,
        rationale:
          "Composite routine embedding divergence: 0.04 → 0.17 → 0.38 over 7 days. " +
          "Cosine distance exceeds 0.25 threshold. Intervention recommended.",
      })
    ).toBe("38% off baseline — intervention");

    expect(
      formatReasoningStatLine({
        signal: "ate",
        cosine_distance: 0.17,
        baseline_window_days: 14,
        rationale:
          "Kitchen dwell 5 min vs baseline 22 min (−77%). " +
          "Pattern consistent with reduced appetite or fatigue over 5 days.",
      })
    ).toBe("Kitchen dwell -77% vs baseline");
  });
});
