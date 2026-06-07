import { describe, expect, it } from "vitest";
import { getSignalSubtitle, getSignalValue } from "./signalValues";
import { makeSignal } from "../../tests/fixtures";

describe("getSignalValue", () => {
  it("returns em dash for unknown state", () => {
    expect(getSignalValue("woke_up", makeSignal("woke_up", { state: "unknown" }))).toBe("—");
  });

  it("extracts wake time from reason", () => {
    expect(
      getSignalValue("woke_up", makeSignal("woke_up", { reason: "Woke at 07:15" }))
    ).toBe("07:15 AM");
  });

  it("returns Awake when green with no reason", () => {
    expect(getSignalValue("woke_up", makeSignal("woke_up"))).toBe("Awake");
  });

  it("maps breakfast lunch and dinner from reason", () => {
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Had breakfast" }))).toBe("Breakfast");
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Ate lunch early" }))).toBe("Lunch");
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Skipped dinner" }))).toBe("Dinner");
  });

  it("returns Minimal for amber ate without reason", () => {
    expect(getSignalValue("ate", makeSignal("ate", { state: "amber" }))).toBe("Minimal");
  });

  it("returns Missed and Late for took_meds alert states", () => {
    expect(getSignalValue("took_meds", makeSignal("took_meds", { state: "red" }))).toBe("Missed");
    expect(getSignalValue("took_meds", makeSignal("took_meds", { state: "amber" }))).toBe("Late");
    expect(getSignalValue("took_meds", makeSignal("took_meds"))).toBe("Morning 3/3");
  });

  it("extracts sleep hours from rested_well reason", () => {
    expect(
      getSignalValue("rested_well", makeSignal("rested_well", { reason: "Slept 7.5 h" }))
    ).toBe("7.5h");
  });

  it("returns Poor for red rested_well without reason", () => {
    expect(getSignalValue("rested_well", makeSignal("rested_well", { state: "red" }))).toBe("Poor");
  });

  it("returns Present for green helper_present", () => {
    expect(getSignalValue("helper_present", makeSignal("helper_present"))).toBe("Present");
  });

  it("returns Distress Unclear Clear for voice_checkin states", () => {
    expect(getSignalValue("voice_checkin", makeSignal("voice_checkin", { state: "red" }))).toBe(
      "Distress"
    );
    expect(getSignalValue("voice_checkin", makeSignal("voice_checkin", { state: "amber" }))).toBe(
      "Unclear"
    );
    expect(getSignalValue("voice_checkin", makeSignal("voice_checkin"))).toBe("Clear");
  });

  it("returns Wandering Away Home area for location states", () => {
    expect(getSignalValue("location", makeSignal("location", { state: "red" }))).toBe("Wandering");
    expect(getSignalValue("location", makeSignal("location", { state: "amber" }))).toBe("Away");
    expect(getSignalValue("location", makeSignal("location"))).toBe("Home area");
  });

  it("returns Off track Drifting On track for routine states", () => {
    expect(getSignalValue("routine", makeSignal("routine", { state: "red" }))).toBe("Off track");
    expect(getSignalValue("routine", makeSignal("routine", { state: "amber" }))).toBe("Drifting");
    expect(getSignalValue("routine", makeSignal("routine"))).toBe("On track");
  });

  it("trims long reasons to 22 chars with ellipsis", () => {
    const long = "This is a very long reason that exceeds limit";
    expect(getSignalValue("routine", makeSignal("routine", { reason: long }))).toBe(
      "This is a very long re…"
    );
  });
});

describe("getSignalSubtitle", () => {
  it("returns empty string for unknown state", () => {
    expect(getSignalSubtitle("ate", makeSignal("ate", { state: "unknown" }))).toBe("");
  });

  it("formats pattern match when cosine distance is present", () => {
    expect(
      getSignalSubtitle("ate", makeSignal("ate", { cosine_distance: 0.1234 }))
    ).toBe("Slightly off usual");
  });

  it("falls back to reason slice when no cosine", () => {
    expect(
      getSignalSubtitle("ate", makeSignal("ate", { reason: "Breakfast delayed significantly today" }))
    ).toBe("Breakfast delayed significantly today");
  });

  it("returns empty when no cosine or reason", () => {
    expect(getSignalSubtitle("ate", makeSignal("ate"))).toBe("");
  });
});
