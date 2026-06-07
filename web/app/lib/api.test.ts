import { afterEach, describe, expect, it, vi } from "vitest";
import { apiUrl } from "./api";

describe("apiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to localhost:8000", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(apiUrl()).toBe("http://localhost:8000");
  });

  it("uses NEXT_PUBLIC_API_URL when set", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.example.com");
    expect(apiUrl()).toBe("http://api.example.com");
  });
});
