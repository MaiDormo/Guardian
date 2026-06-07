"use client";

import type { SignalStateData, ReasoningPayload, SignalName } from "../lib/types";
import { SIGNAL_NAMES } from "../lib/signals";
import SignalCard from "./SignalCard";

function fallbackSignal(name: SignalName): SignalStateData {
  return { signal: name, state: "unknown", reason: "", cosine_distance: null, updated_at: null };
}

interface SignalGridProps {
  signals: Record<string, SignalStateData>;
  reasoning: ReasoningPayload[];
}

export default function SignalGrid({ signals, reasoning }: SignalGridProps) {
  return (
    <section aria-label="Vital signals" className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Vital Signals
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          8 daily signals
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SIGNAL_NAMES.map((name) => (
          <SignalCard
            key={name}
            data={signals[name] ?? fallbackSignal(name as SignalName)}
            reasoning={reasoning.find((r) => r.signal === name) ?? null}
          />
        ))}
      </div>
    </section>
  );
}
