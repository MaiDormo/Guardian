"use client";

import { Play, AlertTriangle, Loader2 } from "lucide-react";
import { runScenario } from "../lib/scenario";

const SCENARIOS = [
  { name: "normal", label: "Normal Morning" },
  { name: "trend_7day", label: "7-Day Trend" },
  { name: "fall", label: "Fall", danger: true },
];

interface ScenarioPlayerProps {
  onScenarioStart: () => void;
  loading: string | null;
  onLoadingChange: (name: string | null) => void;
}

export async function triggerScenario(
  name: string,
  onScenarioStart: () => void,
  onLoadingChange: (name: string | null) => void
): Promise<void> {
  onLoadingChange(name);
  onScenarioStart();
  try {
    await runScenario(name);
  } catch {
    /* fires regardless */
  }
  setTimeout(() => onLoadingChange(null), 500);
}

export default function ScenarioPlayer({
  onScenarioStart,
  loading,
  onLoadingChange,
}: ScenarioPlayerProps) {
  const handleClick = (name: string) => {
    void triggerScenario(name, onScenarioStart, onLoadingChange);
  };

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h2 className="text-label-md uppercase text-muted-foreground">
          Demo Engine
        </h2>
      </header>
      <div className="flex gap-2" role="group" aria-label="Demo scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => handleClick(s.name)}
            disabled={loading !== null}
            aria-busy={loading === s.name}
            aria-label={`Run ${s.label} scenario`}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-label-sm font-semibold transition-all active:scale-95 disabled:opacity-60 ${
              s.danger
                ? "border-alert bg-alert/10 text-alert hover:bg-alert/20"
                : loading === s.name
                  ? "border-highlight/40 bg-highlight/10 text-highlight"
                  : "border-border bg-card/60 text-card-foreground hover:border-highlight/40 hover:text-highlight"
            }`}
          >
            {loading === s.name ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : s.danger ? (
              <AlertTriangle className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" fill="currentColor" aria-hidden="true" />
            )}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
