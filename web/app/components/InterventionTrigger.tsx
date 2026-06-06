"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { InterventionAckPayload } from "../lib/types";

interface InterventionTriggerProps {
  interventionAck: InterventionAckPayload | null;
  scenarioActive: string | null;
}

export default function InterventionTrigger({ interventionAck, scenarioActive }: InterventionTriggerProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    if (scenarioActive) {
      setShowOverlay(false);
    }
  }, [scenarioActive]);

  useEffect(() => {
    if (interventionAck) {
      setDispatching(false);
    }
  }, [interventionAck]);

  const handleDispatch = async () => {
    setDispatching(true);
    setShowOverlay(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      await fetch(`${apiUrl}/trigger/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (e) {
      /* overlay renders regardless */
    }
  };

  return (
    <div>
      <button
        onClick={handleDispatch}
        disabled={dispatching}
        className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary p-3.5 rounded-xl text-label-md font-bold shadow-md hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70"
      >
        {dispatching ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <CheckCircle2 size={18} />
        )}
        Dispatch Local Emergency Care
      </button>

      {showOverlay && (
        <div className="slide-up mt-3 p-3 rounded-xl bg-surface-container border border-primary/20 shadow-sm fade-in">
          <div className="flex items-center gap-3">
            {dispatching ? (
              <Loader2 size={20} className="text-primary animate-spin" />
            ) : (
              <CheckCircle2 size={20} className="text-primary" />
            )}
            <div className="flex flex-col">
              <span className="text-label-sm text-primary font-bold">
                {dispatching ? "Dispatching alert..." : "Alert dispatched"}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                {interventionAck
                  ? interventionAck.message_preview
                  : "Shenzhen Care Network notified"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
