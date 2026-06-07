"use client";

import { useState, useEffect } from "react";
import { Siren, Check, X } from "lucide-react";
import type { InterventionAckPayload } from "../lib/types";
import { dispatchIntervention } from "../lib/intervention";

interface InterventionTriggerProps {
  interventionAck: InterventionAckPayload | null;
  scenarioActive: string | null;
  onDispatch?: () => void;
  dispatching?: boolean;
}

export default function InterventionTrigger({
  interventionAck,
  scenarioActive,
  onDispatch,
  dispatching: externalDispatching,
}: InterventionTriggerProps) {
  const [internalSpinning, setInternalSpinning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const available = interventionAck !== null || scenarioActive === "trend_7day";
  const spinning = externalDispatching ?? internalSpinning;

  useEffect(() => {
    if (scenarioActive) setShowOverlay(false);
  }, [scenarioActive]);

  useEffect(() => {
    if (interventionAck) {
      setInternalSpinning(false);
      setShowOverlay(true);
    }
  }, [interventionAck]);

  const handleDispatch = async () => {
    if (onDispatch) {
      await onDispatch();
      return;
    }
    setInternalSpinning(true);
    try {
      await dispatchIntervention();
    } catch {
      /* overlay renders regardless of network */
    }
    setTimeout(() => setInternalSpinning(false), 600);
  };

  return (
    <section aria-label="Emergency dispatch" className="hidden flex-col gap-2 lg:flex">
      <button
        type="button"
        onClick={handleDispatch}
        disabled={spinning}
        aria-busy={spinning}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-body-sm font-bold uppercase transition-all duration-300 active:scale-[0.98] disabled:opacity-70 ${
          available
            ? "border-alert bg-alert text-alert-foreground hover:brightness-110"
            : "border-border bg-card text-muted-foreground hover:border-alert/50 hover:text-card-foreground"
        }`}
      >
        <Siren className={`size-5 ${spinning ? "animate-spin" : ""}`} aria-hidden="true" />
        {spinning ? "Dispatching…" : "Dispatch Local Emergency Care"}
      </button>

      {available && !showOverlay && (
        <p className="text-center text-label-sm font-medium uppercase text-alert" role="status">
          Anomaly flagged — intervention recommended
        </p>
      )}

      {showOverlay && interventionAck && (
        <div
          role="status"
          aria-live="polite"
          className="slide-up flex items-start gap-3 rounded-xl border border-ok/50 bg-ok/10 p-3"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <Check className="size-4" aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-body-sm font-semibold text-card-foreground">
              Alert dispatched — Shenzhen Care Network notified
            </p>
            <p className="mt-1 font-mono text-label-sm leading-snug text-muted-foreground">
              {interventionAck.message_preview}
            </p>
            <p className="mt-1 text-label-sm uppercase text-muted-foreground">
              via {interventionAck.channel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOverlay(false)}
            aria-label="Dismiss confirmation"
            className="text-muted-foreground transition-colors hover:text-card-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
