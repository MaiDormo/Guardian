import { describe, expect, it } from "vitest";
import {
  SIGNAL_NAMES,
  STATE_CONFIG,
  emptySignalState,
  formatSignalLabel,
} from "./signals";

describe("formatSignalLabel", () => {
  it("maps known signal names to labels", () => {
    expect(formatSignalLabel("woke_up")).toBe("Woke Up");
    expect(formatSignalLabel("voice_checkin")).toBe("Voice Check-In");
  });

  it("title-cases unknown snake_case names", () => {
    expect(formatSignalLabel("custom_signal")).toBe("Custom Signal");
  });
});

describe("emptySignalState", () => {
  it("creates unknown state for all eight signals", () => {
    const state = emptySignalState();
    expect(Object.keys(state)).toHaveLength(SIGNAL_NAMES.length);
    for (const name of SIGNAL_NAMES) {
      expect(state[name]).toMatchObject({
        signal: name,
        state: "unknown",
        reason: "",
        cosine_distance: null,
        updated_at: null,
      });
    }
  });
});

describe("STATE_CONFIG", () => {
  it("defines badge labels for all signal states", () => {
    expect(STATE_CONFIG.green.label).toBe("NORMAL");
    expect(STATE_CONFIG.amber.label).toBe("FAIR");
    expect(STATE_CONFIG.red.label).toBe("ALERT");
    expect(STATE_CONFIG.unknown.label).toBe("IDLE");
  });
});
