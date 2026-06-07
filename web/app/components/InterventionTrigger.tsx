"use client";

import { useState, useEffect } from "react";
import { Siren, Check, X } from "lucide-react";
import type { InterventionAckPayload } from "../lib/types";

interface InterventionTriggerProps {
  interventionAck: InterventionAckPayload | null;
  scenarioActive: string | null;
}

export default function InterventionTrigger({ interventionAck, scenarioActive }: InterventionTriggerProps) {
  const [spinning, setSpinning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const available = interventionAck !== null || scenarioActive === "trend_7day";

  useEffect(() => {
    if (scenarioActive) setShowOverlay(false);
  }, [scenarioActive]);

  useEffect(() => {
    if (interventionAck) {
      setSpinning(false);
      setShowOverlay(true);
    }
  }, [interventionAck]);

  const handleDispatch = async () => {
    setSpinning(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/trigger/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* overlay renders regardless of network */
    }
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <section aria-label="Emergency dispatch" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDispatch}
        disabled={spinning}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all duration-300 active:scale-[0.98] disabled:opacity-70 ${
          available
            ? "border-alert bg-alert text-alert-foreground hover:brightness-110"
            : "border-border bg-card text-muted-foreground hover:border-alert/50 hover:text-card-foreground"
        }`}
      >
        <Siren className={`size-5 ${spinning ? "animate-spin" : ""}`} aria-hidden="true" />
        {spinning ? "Dispatching…" : "Dispatch Local Emergency Care"}
      </button>

      {available && !showOverlay && (
        <p className="text-center text-[10px] font-medium uppercase tracking-wide text-alert">
          Anomaly flagged — intervention recommended
        </p>
      )}

      {showOverlay && interventionAck && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-ok/50 bg-ok/10 p-3 slide-up"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <Check className="size-4" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-card-foreground">
              Alert dispatched — Shenzhen Care Network notified
            </p>
            <p className="mt-1 font-mono text-[11px] leading-snug text-muted-foreground">
              {interventionAck.message_preview}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              via {interventionAck.channel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOverlay(false)}
            aria-label="Dismiss confirmation"
            className="text-muted-foreground hover:text-card-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </section>
  );
}
