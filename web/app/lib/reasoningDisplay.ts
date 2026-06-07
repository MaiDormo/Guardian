/** Demo console: simplified entries (default on for stage pitch). Set NEXT_PUBLIC_REASONING_DEMO_MODE=false for full XML Devpost screenshots. */
export function isReasoningDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_REASONING_DEMO_MODE !== "false";
}

export const DEMO_REASONING_ENTRY_CAP = 4;
