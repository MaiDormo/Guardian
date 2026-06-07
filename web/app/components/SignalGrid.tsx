"use client";

import type { SignalStateData, ReasoningPayload, SignalName } from "../lib/types";
import { SIGNAL_NAMES } from "../lib/signals";
import SignalCard from "./SignalCard";

function fallbackSignal(name: SignalName): SignalStateData {
  return {
    signal: name,
    state: "unknown",
    reason: "",
    cosine_distance: null,
    updated_at: null,
  };
}

interface SignalGridProps {
  signals: Record<string, SignalStateData>;
  reasoning: ReasoningPayload[];
}

export default function SignalGrid({ signals, reasoning }: SignalGridProps) {
  const critical = ["location", "routine"];
  const main = SIGNAL_NAMES.filter((s) => !critical.includes(s));

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-lg">
        {critical.map((name) => (
          <SignalCard
            key={name}
            data={signals[name] ?? fallbackSignal(name as SignalName)}
            reasoning={reasoning.find((r) => r.signal === name) || null}
            critical
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {main.map((name) => (
          <SignalCard
            key={name}
            data={signals[name] ?? fallbackSignal(name as SignalName)}
            reasoning={reasoning.find((r) => r.signal === name) || null}
          />
        ))}
      </div>
    </div>
  );
}
