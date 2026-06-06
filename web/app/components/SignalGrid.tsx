"use client";

import type { SignalStateData, ReasoningPayload } from "../lib/types";
import { SIGNAL_NAMES } from "../lib/signals";
import SignalCard from "./SignalCard";

interface SignalGridProps {
  signals: Record<string, SignalStateData>;
  reasoning: ReasoningPayload[];
}

export default function SignalGrid({ signals, reasoning }: SignalGridProps) {
  const critical = ["location", "routine"];
  const main = SIGNAL_NAMES.filter((s) => !critical.includes(s));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-lg">
        {critical.map((name) => (
          <SignalCard
            key={name}
            data={signals[name]}
            reasoning={reasoning.find((r) => r.signal === name) || null}
            critical
          />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {main.map((name) => (
          <SignalCard
            key={name}
            data={signals[name]}
            reasoning={reasoning.find((r) => r.signal === name) || null}
          />
        ))}
      </div>
    </div>
  );
}
