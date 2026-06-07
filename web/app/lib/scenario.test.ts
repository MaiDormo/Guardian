import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../tests/mocks/server";
import { API } from "../../tests/mocks/handlers";
import { runScenario } from "./scenario";

describe("runScenario", () => {
  it("POSTs to /scenario/:name", async () => {
    let path = "";
    server.use(
      http.post(`${API}/scenario/:name`, ({ params }) => {
        path = params.name as string;
        return HttpResponse.json({ scenario: params.name });
      })
    );

    await runScenario("normal");
    expect(path).toBe("normal");
  });
});
