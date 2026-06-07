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

  it("formats bedroom motion time without xx placeholder", () => {
    expect(
      getSignalValue(
        "woke_up",
        makeSignal("woke_up", { reason: "Bedroom motion at 07:23" })
      )
    ).toBe("07:23 AM");
    expect(
      getSignalValue(
        "woke_up",
        makeSignal("woke_up", { reason: "Bedroom motion at 08:xx" })
      )
    ).toBe("8 AM");
  });

  it("returns Awake when green with no reason", () => {
    expect(getSignalValue("woke_up", makeSignal("woke_up"))).toBe("Awake");
  });

  it("maps breakfast lunch and dinner from reason", () => {
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Had breakfast" }))).toBe("Breakfast");
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Ate lunch early" }))).toBe("Lunch");
    expect(getSignalValue("ate", makeSignal("ate", { reason: "Skipped dinner" }))).toBe("Dinner");
  });

  it("returns Light meal for amber ate without reason", () => {
    expect(getSignalValue("ate", makeSignal("ate", { state: "amber" }))).toBe("Light meal");
  });

  it("formats kitchen dwell without truncation", () => {
    expect(
      getSignalValue("ate", makeSignal("ate", { reason: "Kitchen dwell 22 min" }))
    ).toBe("22 min");
    expect(
      getSignalSubtitle("ate", makeSignal("ate", { reason: "Kitchen dwell 22 min" }))
    ).toBe("22 min in kitchen");
  });

  it("formats breathing rate without truncation", () => {
    expect(
      getSignalValue("rested_well", makeSignal("rested_well", { reason: "Breathing rate 14 bpm" }))
    ).toBe("14 bpm");
    expect(
      getSignalSubtitle("rested_well", makeSignal("rested_well", { reason: "Breathing rate 14 bpm" }))
    ).toBe("Normal breathing rate");
  });

  it("returns friendly took_meds headlines", () => {
    expect(getSignalValue("took_meds", makeSignal("took_meds", { state: "red" }))).toBe("Missed");
    expect(getSignalValue("took_meds", makeSignal("took_meds", { state: "amber" }))).toBe("Late");
    expect(getSignalValue("took_meds", makeSignal("took_meds"))).toBe("Morning 3/3");
    expect(
      getSignalValue(
        "took_meds",
        makeSignal("took_meds", { reason: "Dispenser opened — compartment morning" })
      )
    ).toBe("Morning dose");
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
    expect(
      getSignalValue(
        "helper_present",
        makeSignal("helper_present", {
          reason: "Second presence detected in helper window",
        })
      )
    ).toBe("Present");
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

  it("returns friendly location headlines for all states", () => {
    expect(getSignalValue("location", makeSignal("location", { state: "red" }))).toBe("Wandering");
    expect(getSignalValue("location", makeSignal("location", { state: "amber" }))).toBe("Away");
    expect(getSignalValue("location", makeSignal("location"))).toBe("Usual route");
    expect(
      getSignalValue(
        "location",
        makeSignal("location", { reason: "Density score 0.91" })
      )
    ).toBe("91%");
  });

  it("returns friendly routine headlines ignoring jargon reasons", () => {
    expect(getSignalValue("routine", makeSignal("routine", { state: "red" }))).toBe("Off track");
    expect(getSignalValue("routine", makeSignal("routine", { state: "amber" }))).toBe("Drifting");
    expect(getSignalValue("routine", makeSignal("routine"))).toBe("On track");
    expect(
      getSignalValue(
        "routine",
        makeSignal("routine", { reason: "Cosine distance 0.04", cosine_distance: 0.04 })
      )
    ).toBe("On track");
  });

  it("maps voice_checkin jargon reason to Clear headline", () => {
    expect(
      getSignalValue(
        "voice_checkin",
        makeSignal("voice_checkin", { reason: "Speech 138 wpm, clarity 0.87" })
      )
    ).toBe("Clear");
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

  it("uses friendly ate subtitle for breakfast reasons", () => {
    expect(
      getSignalSubtitle("ate", makeSignal("ate", { reason: "Breakfast delayed significantly today" }))
    ).toBe("Breakfast detected in kitchen");
  });

  it("returns empty when no cosine or reason", () => {
    expect(getSignalSubtitle("ate", makeSignal("ate"))).toBe("");
  });

  it("formats location subtitle from density score reason", () => {
    expect(
      getSignalSubtitle(
        "location",
        makeSignal("location", { reason: "Density score 0.91" })
      )
    ).toBe("91% familiar with usual route");
  });

  it("formats routine subtitle from cosine distance not jargon reason", () => {
    expect(
      getSignalSubtitle(
        "routine",
        makeSignal("routine", { reason: "Cosine distance 0.04", cosine_distance: 0.04 })
      )
    ).toBe("Matches usual pattern");
  });

  it("formats voice subtitle with clarity percent", () => {
    expect(
      getSignalSubtitle(
        "voice_checkin",
        makeSignal("voice_checkin", { reason: "Speech 138 wpm, clarity 0.87" })
      )
    ).toBe("87% voice clarity · sounds like her usual self");
  });

  it("skips technical reason fallback for jargon strings", () => {
    expect(
      getSignalSubtitle("location", makeSignal("location", { reason: "Density score 0.91" }))
    ).not.toContain("Density score");
  });

  it("shows friendly helper_present subtitle without mid-word truncation", () => {
    expect(
      getSignalSubtitle(
        "helper_present",
        makeSignal("helper_present", {
          reason: "Second presence detected in helper window",
        })
      )
    ).toBe("Helper here during usual window");
    expect(
      getSignalSubtitle(
        "helper_present",
        makeSignal("helper_present", {
          reason: "Second presence detected in helper window",
        })
      )
    ).not.toMatch(/helper windo$/);
  });

  it("shows friendly took_meds subtitle without dispenser jargon", () => {
    expect(
      getSignalSubtitle(
        "took_meds",
        makeSignal("took_meds", { reason: "Dispenser opened — compartment morning" })
      )
    ).toBe("Morning compartment · on schedule");
  });

  it("shows friendly woke_up subtitle without xx", () => {
    expect(
      getSignalSubtitle(
        "woke_up",
        makeSignal("woke_up", { reason: "Bedroom motion at 07:23" })
      )
    ).toBe("Morning bedroom activity");
    expect(
      getSignalSubtitle(
        "woke_up",
        makeSignal("woke_up", { reason: "Bedroom motion at 08:xx" })
      )
    ).toBe("Morning bedroom activity");
  });
});
