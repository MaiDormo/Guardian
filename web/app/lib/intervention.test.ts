import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../tests/mocks/server";
import { API } from "../../tests/mocks/handlers";
import { dispatchIntervention } from "./intervention";

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
