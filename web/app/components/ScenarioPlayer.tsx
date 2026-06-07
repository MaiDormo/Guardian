"use client";

import { useState } from "react";
import { Play, AlertTriangle, Loader2 } from "lucide-react";
import { apiUrl } from "../lib/api";

const SCENARIOS = [
  { name: "normal", label: "Normal Morning" },
  { name: "trend_7day", label: "7-Day Trend" },
  { name: "fall", label: "Fall Override", danger: true },
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
    } catch (e) {
      /* scenario fires regardless */
    }
    setTimeout(() => setLoading(null), 500);
  };

  return (
    <div className="flex gap-3">
      {SCENARIOS.map((s) => {
        const isFall = s.danger;
        return (
          <button
            key={s.name}
            onClick={() => handleClick(s.name)}
            disabled={loading !== null}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-label-sm font-bold transition-all active:scale-95 flex-1 ${
              isFall
                ? "bg-error text-on-error hover:bg-error/90 shadow-sm"
                : loading === s.name
                  ? "bg-primary/20 text-primary"
                  : "bg-primary-container text-on-primary-container hover:bg-primary-container/80"
            } ${loading === s.name ? "opacity-70" : ""}`}
          >
            {loading === s.name ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isFall ? (
              <AlertTriangle size={14} />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
