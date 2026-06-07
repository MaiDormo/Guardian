"use client";

import type { SignalStateData, ReasoningPayload } from "../lib/types";
import { formatSignalLabel } from "../lib/signals";
import { SignalIcon } from "../lib/icons";

interface SignalCardProps {
  data: SignalStateData;
  reasoning?: ReasoningPayload | null;
}

const STATE_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  green: { dot: "bg-ok", badge: "bg-ok/15 text-ok", label: "OK" },
  amber: { dot: "bg-warn", badge: "bg-warn/15 text-warn", label: "Amber" },
  red: { dot: "bg-alert", badge: "bg-alert/15 text-alert", label: "Alert" },
  unknown: { dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground", label: "Unknown" },
};

export default function SignalCard({ data, reasoning }: SignalCardProps) {
  const style = STATE_STYLES[data.state] ?? STATE_STYLES.unknown;
  const signalLabel = formatSignalLabel(data.signal);

  return (
    <article
      aria-label={`${signalLabel}: ${style.label}`}
      className={`flex h-full min-h-[88px] flex-col gap-1.5 rounded-lg border p-3 shadow-panel transition-colors duration-500 ${
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

      <h3 className="text-body-sm font-medium text-card-foreground">{signalLabel}</h3>

      {data.state !== "unknown" && reasoning?.cosine_distance != null && (
        <p className="font-mono text-label-sm tabular-nums text-muted-foreground">
          d={reasoning.cosine_distance.toFixed(2)}
        </p>
      )}

      {data.state === "unknown" && (
        <p className="text-label-sm text-muted-foreground/60">Awaiting baseline…</p>
      )}
    </article>
  );
}
