"use client";

import type { ReasoningPayload } from "../lib/types";
import { formatSignalLabel } from "../lib/signals";

interface ReasoningPanelProps {
  reasoning: ReasoningPayload[];
}

export default function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  if (reasoning.length === 0) {
    return (
      <div className="border border-outline-variant rounded-xl p-lg bg-surface-container-low h-full">
        <h2 className="text-headline-md text-on-surface mb-md">Agent Reasoning</h2>
        <div className="flex items-center justify-center h-32">
          <p className="text-body-sm text-on-surface-variant italic">
            Agent reasoning will appear here as signals update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-outline-variant rounded-xl p-lg bg-surface-container-low h-full">
      <h2 className="text-headline-md text-on-surface mb-md">Agent Reasoning</h2>
      <div className="space-y-3 overflow-y-auto max-h-[500px]">
        {[...reasoning].reverse().map((entry, i) => {
          const isRed = entry.cosine_distance !== null && entry.cosine_distance > 0.25;
          return (
            <div
              key={`${entry.signal}-${entry.updated_at}-${i}`}
              className={`p-3 rounded-lg border text-sm ${
                isRed
                  ? "bg-error-container border-error/20 text-on-error-container"
                  : "bg-surface-container border-outline-variant/50 text-on-surface-variant"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-bold text-label-sm ${isRed ? "text-error" : "text-on-surface"}`}>
                  {formatSignalLabel(entry.signal)}
                </span>
                {entry.cosine_distance !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isRed ? "bg-error/10 text-on-error-container" : "bg-surface-container-highest text-on-surface-variant"
                  }`}>
                    d={entry.cosine_distance.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-body-sm leading-relaxed">{entry.rationale}</p>
              {entry.features_considered && entry.features_considered.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {entry.features_considered.map((f) => (
                    <span key={f} className="text-[9px] bg-surface-container-highest/50 px-1.5 py-0.5 rounded-full">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
