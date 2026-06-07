"use client";

import { useState, useEffect } from "react";
import { Siren, Check, X, Loader2 } from "lucide-react";
import type { InterventionAckPayload } from "../lib/types";
import { dispatchIntervention } from "../lib/intervention";

interface InterventionTriggerProps {
  interventionAck: InterventionAckPayload | null;
  scenarioActive: string | null;
  interventionRecommended: boolean;
  onDispatch?: () => void;
  dispatching?: boolean;
  className?: string;
}

export default function InterventionTrigger({
  interventionAck,
  scenarioActive,
  interventionRecommended,
  onDispatch,
  dispatching: externalDispatching,
  className = "hidden lg:flex",
}: InterventionTriggerProps) {
  const [internalSpinning, setInternalSpinning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const available = interventionRecommended;
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
    setShowOverlay(true);
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
    <section aria-label="Emergency dispatch" className={`flex-col gap-2 ${className}`}>
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

      {showOverlay && (
        <div
          role="status"
          aria-live="polite"
          className="slide-up flex items-start gap-3 rounded-xl border border-ok/50 bg-ok/10 p-3"
        >
          {spinning ? (
            <Loader2 className="mt-0.5 size-6 shrink-0 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <Check className="size-4" aria-hidden="true" />
            </span>
          )}
          <div className="flex-1">
            <p className="text-body-sm font-semibold text-card-foreground">
              {spinning
                ? "Dispatching alert…"
                : "Alert dispatched — Shenzhen Care Network notified"}
            </p>
            {!spinning && (
              <>
                <p className="mt-1 font-mono text-label-sm leading-snug text-muted-foreground">
                  {interventionAck?.message_preview ?? "Awaiting confirmation from care network"}
                </p>
                {interventionAck?.channel && (
                  <p className="mt-1 text-label-sm uppercase text-muted-foreground">
                    via {interventionAck.channel}
                  </p>
                )}
              </>
            )}
          </div>
          {!spinning && (
            <button
              type="button"
              onClick={() => setShowOverlay(false)}
              aria-label="Dismiss confirmation"
              className="text-muted-foreground transition-colors hover:text-card-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
