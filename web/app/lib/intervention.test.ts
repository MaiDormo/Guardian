import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../tests/mocks/server";
import { API } from "../../tests/mocks/handlers";
import { dispatchIntervention, isInterventionRecommended } from "./intervention";
import { makeSignal } from "../../tests/fixtures";

describe("isInterventionRecommended", () => {
  it("returns true when intervention ack exists", () => {
    expect(
      isInterventionRecommended({}, {
        dispatched: true,
        channel: "overlay_only",
        message_preview: "ok",
        updated_at: "2026-06-07T10:00:00Z",
      })
    ).toBe(true);
  });

  it("returns true when any crisis signal is red", () => {
    const signals = {
      voice_checkin: makeSignal("voice_checkin", { state: "red" }),
    };
    expect(isInterventionRecommended(signals, null)).toBe(true);
  });

  it("returns false during trend before crisis signals turn red", () => {
    const signals = {
      voice_checkin: makeSignal("voice_checkin", { state: "amber" }),
      routine: makeSignal("routine", { state: "green" }),
    };
    expect(isInterventionRecommended(signals, null)).toBe(false);
  });
});

describe("dispatchIntervention", () => {
  it("POSTs to /trigger/intervention", async () => {
    let called = false;
    server.use(
      http.post(`${API}/trigger/intervention`, async ({ request }) => {
        called = true;
        expect(request.method).toBe("POST");
        expect(await request.json()).toEqual({});
        return HttpResponse.json({ ok: true });
      })
    );

    await dispatchIntervention();
    expect(called).toBe(true);
  });
});
