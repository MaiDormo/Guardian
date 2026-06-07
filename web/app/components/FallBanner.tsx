"use client";

import { AlertTriangle, X } from "lucide-react";
import type { FallPayload } from "../lib/types";

interface FallBannerProps {
  fall: FallPayload | null;
  onDismiss: () => void;
  autoDispatched?: boolean;
}

export default function FallBanner({ fall, onDismiss, autoDispatched = false }: FallBannerProps) {
  if (!fall) return null;

  const roomLabel = fall.room.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="col-span-full slide-down" role="alert" aria-live="assertive">
      <div className="flex items-center justify-between rounded-xl border border-alert bg-alert/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 shrink-0 text-alert animate-pulse" aria-hidden="true" />
          <div>
            <p className="text-body-sm font-bold uppercase text-alert">
              Fall Detected · Safety-reflex tier
            </p>
            <p className="text-label-sm text-pretty text-muted-foreground">
              {roomLabel} · {fall.posture} · {fall.stationary_s}s stationary ·{" "}
              {(fall.confidence * 100).toFixed(0)}% confidence
            </p>
            {autoDispatched && (
              <p className="mt-1 text-label-sm font-semibold text-ok">
                Emergency alert auto-dispatched to care network
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss fall alert"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-alert/10 hover:text-alert"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
