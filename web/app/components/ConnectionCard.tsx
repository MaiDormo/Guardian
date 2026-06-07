"use client";

import { useState } from "react";
import { PhoneCall, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ConnectionAckPayload, ConnectionWindowPayload } from "../lib/types";
import { apiUrl } from "../lib/api";

interface ConnectionCardProps {
  window: ConnectionWindowPayload | null;
  connectionAck: ConnectionAckPayload | null;
}

export default function ConnectionCard({ window: w, connectionAck }: ConnectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [sending, setSending] = useState(false);

  if (!w) return null;

  const clarityPct = w.evidence?.avg_clarity != null
    ? (w.evidence.avg_clarity * 100).toFixed(0)
    : null;

  const handleNudge = async () => {
    setSending(true);
    setNudged(true);
    try {
      await fetch(`${apiUrl()}/trigger/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* overlay renders regardless */
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label="Optimal connection window"
      className="flex flex-col gap-3 rounded-xl border border-highlight/40 bg-highlight/5 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Optimal Connection Window
          </h2>
          <p className="mt-1 text-xl font-semibold text-card-foreground">{w.best_window}</p>
        </div>
        {clarityPct && (
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              voice clarity
            </p>
            <p className="font-mono text-sm text-ok">{clarityPct}%</p>
          </div>
        )}
      </div>

      <p className="text-xs leading-snug text-muted-foreground">
        {w.overlap_with_child
          ? "Ah-Ma is reliably calm and clear-spoken in this window — you're both free."
          : "Ah-Ma's calm window doesn't fully overlap your schedule today."}
      </p>

      <div className="flex items-center justify-between gap-2">
        {w.evidence?.presence_days != null && (
          <span className="text-[11px] text-muted-foreground font-mono">
            {w.evidence.presence_days}/{w.evidence.baseline_days}d baseline
          </span>
        )}
        <button
          type="button"
          onClick={handleNudge}
          disabled={nudged || sending}
          className="flex items-center gap-1.5 rounded-lg bg-highlight px-3 py-1.5 text-xs font-semibold text-[oklch(0.16_0.012_250)] transition-colors hover:bg-highlight/90 disabled:opacity-70 ml-auto"
        >
          {nudged ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              {connectionAck ? "Nudge sent" : "Sent"}
            </>
          ) : (
            <>
              <PhoneCall className="size-3.5" aria-hidden="true" />
              Send call nudge
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        {expanded ? "Hide reasoning" : "Why this window?"}
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-border/40 pt-2 space-y-1 fade-in">
          <p className="text-xs leading-relaxed text-muted-foreground">{w.rationale}</p>
        </div>
      )}
    </section>
  );
}
