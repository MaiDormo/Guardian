import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playFallAlert } from "./fallAlert";

describe("playFallAlert", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips audio when prefers-reduced-motion is set", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn() })
    );
    const start = vi.fn();
    class MockAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator() {
        return { start, stop: vi.fn(), connect: vi.fn(), frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: "sine", onended: null };
      }
      createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
      }
      close = vi.fn();
    }
    vi.stubGlobal("AudioContext", MockAudioContext);

    playFallAlert();
    expect(start).not.toHaveBeenCalled();
  });

  it("creates oscillator when motion is allowed", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn() })
    );
    const start = vi.fn();
    class MockAudioContext {
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          type: "sine",
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start,
          stop: vi.fn(),
          onended: null as (() => void) | null,
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      close = vi.fn();
    }
    vi.stubGlobal("AudioContext", MockAudioContext);

    playFallAlert();
    expect(start).toHaveBeenCalled();
  });
});
