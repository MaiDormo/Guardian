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
  unknown: { dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground", label: "—" },
};

export default function SignalCard({ data, reasoning }: SignalCardProps) {
  const style = STATE_STYLES[data.state] ?? STATE_STYLES.unknown;

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border p-3 transition-colors duration-500 ${
        data.state === "red"
          ? "border-alert/40 bg-alert/5"
          : data.state === "amber"
            ? "border-warn/30 bg-warn/5"
            : "border-border bg-card/60"
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
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${style.badge}`}>
          {style.label}
        </span>
      </div>

      <h3 className="text-xs font-medium text-card-foreground">{formatSignalLabel(data.signal)}</h3>

      {data.state !== "unknown" && reasoning?.cosine_distance != null && (
        <p className="font-mono text-[10px] text-muted-foreground">
          d={reasoning.cosine_distance.toFixed(2)}
        </p>
      )}

      {data.state === "unknown" && (
        <p className="text-[10px] text-muted-foreground/60">Awaiting baseline…</p>
      )}
    </div>
  );
}
