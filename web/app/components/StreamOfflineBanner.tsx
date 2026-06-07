"use client";

import { WifiOff } from "lucide-react";
import type { SSEHealth } from "../lib/useSSE";

interface StreamOfflineBannerProps {
  sseHealth: SSEHealth;
  backendConnected: boolean;
}

export default function StreamOfflineBanner({
  sseHealth,
  backendConnected,
}: StreamOfflineBannerProps) {
  const showOffline = sseHealth === "disconnected" && !backendConnected;
  const showReconnecting = sseHealth === "reconnecting" && !backendConnected;

  if (!showOffline && !showReconnecting) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
        showOffline
          ? "border-error/40 bg-error/5 text-error"
          : "border-warn/40 bg-warn/5 text-warn"
      }`}
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold">
          {showOffline ? "Live stream offline" : "Reconnecting to backend…"}
        </p>
        <p className="text-pretty text-label-sm text-muted-foreground">
          {showOffline ? (
            <>
              Start the Guardian backend (<code className="font-mono">docker compose up</code>
              ) and refresh. Cards show demo placeholders until SSE connects.
            </>
          ) : (
            <>Retrying the event stream — live updates will resume automatically.</>
          )}
        </p>
      </div>
    </div>
  );
}
