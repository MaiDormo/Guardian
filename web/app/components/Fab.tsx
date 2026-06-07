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
        <div className="fixed bottom-36 left-4 right-4 z-40 max-w-lg mx-auto slide-up md:hidden">
          <div className="p-3 rounded-xl bg-surface-container border border-primary/20 shadow-lg">
            <div className="flex items-center gap-3">
              {dispatching ? (
                <Loader2 size={20} className="text-primary animate-spin shrink-0" />
              ) : (
                <CheckCircle2 size={20} className="text-primary shrink-0" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-label-sm text-primary font-bold">
                  {dispatching ? "Dispatching alert..." : "Alert dispatched"}
                </span>
                <span className="text-body-sm text-on-surface-variant truncate">
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
          className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 hover:shadow-2xl disabled:opacity-70 z-40 md:hidden"
        >
          {dispatching ? (
            <Loader2 size={28} className="animate-spin" />
          ) : (
            <PhoneCall size={28} />
          )}
        </button>
      )}
    </>
  );
}
