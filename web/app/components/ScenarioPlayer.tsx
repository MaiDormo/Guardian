"use client";

import { useState } from "react";
import { Play, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { apiUrl } from "../lib/api";

const SCENARIOS = [
  { name: "normal", label: "Normal Morning" },
  { name: "trend_7day", label: "7-Day Trend" },
  { name: "fall", label: "Fall", danger: true },
];

interface ScenarioPlayerProps {
  onScenarioStart: () => void;
}

export default function ScenarioPlayer({ onScenarioStart }: ScenarioPlayerProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleClick = async (name: string) => {
    setLoading(name);
    onScenarioStart();
    try {
      await fetch(`${apiUrl()}/scenario/${name}`, { method: "POST" });
    } catch {
      /* fires regardless */
    }
    setTimeout(() => setLoading(null), 500);
  };

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Demo Engine
        </h2>
        <RotateCcw className="size-3.5 text-muted-foreground/50" aria-hidden="true" />
      </header>
      <div className="flex gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.name}
            onClick={() => handleClick(s.name)}
            disabled={loading !== null}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${
              s.danger
                ? "border-alert bg-alert/10 text-alert hover:bg-alert/20"
                : loading === s.name
                  ? "border-highlight/40 bg-highlight/10 text-highlight"
                  : "border-border bg-card/60 text-card-foreground hover:border-highlight/40 hover:text-highlight"
            }`}
          >
            {loading === s.name ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : s.danger ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <Play className="size-3.5" fill="currentColor" />
            )}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
