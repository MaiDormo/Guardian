"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SignalStateData, ReasoningPayload } from "../lib/types";
import type { SignalName } from "../lib/types";
import { formatSignalLabel } from "../lib/signals";
import { getSignalValue, getSignalSubtitle } from "../lib/signalValues";
import {
  formatBaselineComparison,
  formatPatternMatch,
  humanizeFeatures,
} from "../lib/friendlyMetrics";
import { SignalIcon } from "../lib/icons";

interface SignalCardProps {
  data: SignalStateData;
  reasoning?: ReasoningPayload | null;
}

const STATE_STYLES: Record<string, { badge: string; label: string }> = {
  green: { badge: "bg-ok/15 text-ok", label: "OK" },
  amber: { badge: "bg-warn/15 text-warn", label: "Amber" },
  red: { badge: "bg-alert/15 text-alert", label: "Alert" },
  unknown: { badge: "bg-muted text-muted-foreground", label: "Unknown" },
};

export default function SignalCard({ data, reasoning }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = STATE_STYLES[data.state] ?? STATE_STYLES.unknown;
  const signalLabel = formatSignalLabel(data.signal);
  const value = getSignalValue(data.signal as SignalName, data);
  const subtitle =
    getSignalSubtitle(data.signal as SignalName, data) ||
    formatPatternMatch(reasoning?.cosine_distance) ||
    "";
  const hasReasoning = Boolean(reasoning?.rationale || data.reason);
  const rationaleId = `signal-reasoning-${data.signal}`;

  return (
    <article
      aria-label={`${signalLabel}: ${style.label}, ${value}`}
      className={`flex h-full min-h-[96px] flex-col gap-1 rounded-lg border p-3 shadow-panel transition-colors duration-500 ${
        data.state === "red"
          ? "border-alert/40 bg-alert/5"
          : data.state === "amber"
            ? "border-warn/30 bg-warn/5"
            : "border-border bg-surface-container-low"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <SignalIcon
          name={data.signal}
          className={`size-3.5 ${
            data.state === "red"
              ? "text-alert"
              : data.state === "amber"
                ? "text-warn"
                : "text-muted-foreground"
          }`}
        />
        <span
          className={`rounded-full px-1.5 py-0.5 text-label-sm font-semibold ${style.badge}`}
        >
          <span className="sr-only">Status: </span>
          {style.label}
        </span>
      </div>

      <h3 className="text-label-sm font-medium text-muted-foreground">{signalLabel}</h3>

      {data.state === "unknown" ? (
        <p className="text-body-sm text-muted-foreground/60">Awaiting baseline…</p>
      ) : (
        <p className="font-display text-body-md font-semibold tabular-nums text-card-foreground">
          {value}
        </p>
      )}

      {subtitle && data.state !== "unknown" && (
        <p className="text-label-sm text-pretty text-muted-foreground">{subtitle}</p>
      )}

      {hasReasoning && data.state !== "unknown" && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={rationaleId}
            className="mt-auto flex items-center gap-0.5 text-label-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
          >
            {expanded ? "Hide" : "Why?"}
            {expanded ? (
              <ChevronUp className="size-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3" aria-hidden="true" />
            )}
          </button>

          {expanded && (
            <div id={rationaleId} className="fade-in space-y-1 border-t border-border/40 pt-1.5">
              <p className="text-pretty text-label-sm leading-relaxed text-muted-foreground">
                {reasoning?.rationale ?? data.reason}
              </p>
              {reasoning && (
                <p className="text-label-sm text-muted-foreground/70">
                  {[
                    formatPatternMatch(reasoning.cosine_distance),
                    formatBaselineComparison(reasoning.baseline_window_days),
                    reasoning.features_considered.length > 0
                      ? `Signals checked: ${humanizeFeatures(reasoning.features_considered)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}
