"use client";

import { AlertTriangle, X } from "lucide-react";
import type { FallPayload } from "../lib/types";

interface FallBannerProps {
  fall: FallPayload | null;
  onDismiss: () => void;
}

export default function FallBanner({ fall, onDismiss }: FallBannerProps) {
  if (!fall) return null;

  const roomLabel = fall.room.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="col-span-full slide-down">
      <div className="flex items-center justify-between rounded-xl border border-alert bg-alert/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-alert animate-pulse shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-alert">
              Fall Detected · Safety-reflex tier
            </p>
            <p className="text-xs text-muted-foreground">
              {roomLabel} · {fall.posture} · {fall.stationary_s}s stationary ·{" "}
              {(fall.confidence * 100).toFixed(0)}% confidence
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss fall alert"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-alert/10 hover:text-alert transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
