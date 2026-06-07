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
  const rationaleId = "connection-rationale";

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
      className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-surface-container-low p-3 shadow-panel"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-label-md uppercase text-muted-foreground">
            Optimal Connection Window
          </h2>
          <p className="mt-1 font-display text-balance text-headline-md text-card-foreground">
            {w.best_window}
          </p>
        </div>
        {clarityPct && (
          <div className="text-right">
            <p className="font-mono text-label-sm uppercase text-muted-foreground">
              voice clarity
            </p>
            <p className="font-mono text-body-sm tabular-nums text-ok">{clarityPct}%</p>
          </div>
        )}
      </div>

      <p className="text-pretty text-body-sm leading-snug text-muted-foreground">
        {w.overlap_with_child
          ? "Ah-Ma is reliably calm and clear-spoken in this window — you're both free."
          : "Ah-Ma's calm window doesn't fully overlap your schedule today."}
      </p>

      <div className="flex items-center justify-between gap-2">
        {w.evidence?.presence_days != null && (
          <span className="font-mono text-label-sm tabular-nums text-muted-foreground">
            {w.evidence.presence_days}/{w.evidence.baseline_days}d baseline
          </span>
        )}
        <button
          type="button"
          onClick={handleNudge}
          disabled={nudged || sending}
          aria-busy={sending}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-70"
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
        aria-expanded={expanded}
        aria-controls={rationaleId}
        className="flex items-center justify-center gap-1 text-label-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
      >
        {expanded ? "Hide reasoning" : "Why this window?"}
        {expanded ? (
          <ChevronUp className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id={rationaleId} className="fade-in space-y-1 border-t border-border/40 pt-2">
          <p className="text-pretty text-body-sm leading-relaxed text-muted-foreground">
            {w.rationale}
          </p>
        </div>
      )}
    </section>
  );
}
