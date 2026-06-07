"use client";

import { PhoneCall, Loader2, CheckCircle2 } from "lucide-react";
import type { InterventionAckPayload } from "../lib/types";

interface FabProps {
  onDispatch: () => void;
  dispatching: boolean;
  dispatched: boolean;
  interventionAck: InterventionAckPayload | null;
}

export default function Fab({
  onDispatch,
  dispatching,
  dispatched,
  interventionAck,
}: FabProps) {
  const showAck = dispatched || interventionAck !== null;

  return (
    <>
      {showAck && (
        <div
          className="fixed bottom-36 left-4 right-4 z-40 mx-auto max-w-lg slide-up lg:hidden"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-xl border border-primary/20 bg-surface-container p-3 shadow-lg">
            <div className="flex items-center gap-3">
              {dispatching ? (
                <Loader2 size={20} className="shrink-0 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={20} className="shrink-0 text-primary" aria-hidden="true" />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="text-label-sm font-bold text-primary">
                  {dispatching ? "Dispatching alert..." : "Alert dispatched"}
                </span>
                <span className="truncate text-body-sm text-on-surface-variant">
                  {interventionAck?.message_preview ?? "Shenzhen Care Network notified"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!dispatched && (
        <button
          type="button"
          onClick={onDispatch}
          disabled={dispatching}
          aria-label="Dispatch emergency care"
          aria-busy={dispatching}
          className="fixed bottom-24 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform hover:shadow-2xl active:scale-90 disabled:opacity-70 lg:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {dispatching ? (
            <Loader2 size={28} className="animate-spin" aria-hidden="true" />
          ) : (
            <PhoneCall size={28} aria-hidden="true" />
          )}
        </button>
      )}
    </>
  );
}
