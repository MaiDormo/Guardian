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
    <div className="w-full mt-4">
      <button
        onClick={handleDispatch}
        disabled={dispatching}
        className="w-full flex items-center justify-center gap-2 bg-error text-on-error p-4 rounded-xl text-headline-md font-bold shadow-md hover:bg-error/90 transition-all active:scale-[0.98] disabled:opacity-70"
      >
        {dispatching ? (
          <Loader2 size={24} className="animate-spin" />
        ) : (
          <span className="text-[24px]">🚨</span>
        )}
        Dispatch Local Care
      </button>

      {showOverlay && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm fade-in px-4">
          <div className="slide-up p-6 rounded-2xl bg-surface border border-primary/20 shadow-2xl max-w-sm w-full">
            <div className="flex items-center gap-4">
              {dispatching ? (
                <Loader2 size={28} className="text-primary animate-spin shrink-0" />
              ) : (
                <CheckCircle2 size={28} className="text-primary shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-headline-md text-primary font-bold">
                  {dispatching ? "Dispatching..." : "Alert Dispatched"}
                </span>
                <span className="text-body-lg text-on-surface mt-1">
                  {interventionAck
                    ? interventionAck.message_preview
                    : "Shenzhen Care Network notified."}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
