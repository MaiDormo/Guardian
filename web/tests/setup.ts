import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Element.prototype.scrollIntoView = vi.fn();

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string; className?: string }) => {
    const { createElement } = require("react") as typeof import("react");
    return createElement("img", {
      src: props.src,
      alt: props.alt,
      className: props.className,
    });
  },
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());
