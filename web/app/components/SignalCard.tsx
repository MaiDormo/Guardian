"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SignalStateData, ReasoningPayload } from "../lib/types";
import { STATE_CONFIG, formatSignalLabel } from "../lib/signals";
import { SignalIcon } from "../lib/icons";
import { getSignalValue } from "../lib/signalValues";

interface SignalCardProps {
  data: SignalStateData;
  reasoning?: ReasoningPayload | null;
  critical?: boolean;
}

export default function SignalCard({ data, reasoning, critical }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATE_CONFIG[data.state];
  const isRed = data.state === "red";

  const cardBg = critical && isRed
    ? "bg-error-container border border-error/20"
    : "bg-surface-container-low border border-outline-variant";

  const valueClass = critical && isRed
    ? "text-headline-md text-error"
    : "text-headline-md text-on-surface";

  return (
    <div
      className={`${cardBg} rounded-xl flex flex-col gap-1 cursor-pointer transition-all hover:shadow-md active:scale-[0.98]`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <SignalIcon
            name={data.signal}
            className={critical && isRed ? "text-error" : isRed ? "text-error" : data.state === "amber" ? "text-amber-500" : "text-primary"}
          />
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.badgeClass}`}>
            {cfg.label}
          </span>
        </div>
        <h3 className="text-label-md text-on-surface-variant">{formatSignalLabel(data.signal)}</h3>
        <p className={valueClass}>{getSignalValue(data.signal as any, data)}</p>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-outline-variant/30 pt-3 mt-0 fade-in space-y-2">
          {reasoning ? (
            <>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                {reasoning.rationale}
              </p>
              {reasoning.features_considered && reasoning.features_considered.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {reasoning.features_considered.map((f) => (
                    <span key={f} className="text-[9px] bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 rounded-full">
                      {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
              {reasoning.cosine_distance !== null && (
                <p className="text-body-sm text-on-surface-variant">
                  Cosine distance: {reasoning.cosine_distance.toFixed(2)}
                  {reasoning.baseline_window_days && ` · ${reasoning.baseline_window_days}d window`}
                </p>
              )}
            </>
          ) : (
            <p className="text-body-sm text-on-surface-variant italic">
              No detailed reasoning available.
            </p>
          )}
          <div className="flex justify-center pt-1">
            <ChevronUp size={14} className="text-on-surface-variant/60" />
          </div>
        </div>
      )}

      {!expanded && (
        <div className="px-4 pb-3 flex justify-center">
          <ChevronDown size={14} className="text-on-surface-variant/40" />
        </div>
      )}
    </div>
  );
}
