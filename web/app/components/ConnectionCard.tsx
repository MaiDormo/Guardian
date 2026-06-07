"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Phone } from "lucide-react";
import type { ConnectionAckPayload, ConnectionWindowPayload } from "../lib/types";
import { apiUrl } from "../lib/api";

const CONFIDENCE_CONFIG = {
  high: { label: "High confidence", dot: "bg-primary" },
  moderate: { label: "Moderate confidence", dot: "bg-amber-500" },
  low: { label: "Low confidence", dot: "bg-secondary" },
} as const;

interface ConnectionCardProps {
  window: ConnectionWindowPayload | null;
  connectionAck: ConnectionAckPayload | null;
}

export default function ConnectionCard({ window, connectionAck }: ConnectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  if (!window) {
    return null;
  }

  const confidence = CONFIDENCE_CONFIG[window.confidence] ?? CONFIDENCE_CONFIG.moderate;

  const handleCallNow = async () => {
    setDispatching(true);
    setShowOverlay(true);
    try {
      await fetch(`${apiUrl()}/trigger/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* overlay renders regardless */
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="rounded-xl border border-secondary/30 bg-secondary-container/40 shadow-sm">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center">
              <Phone size={18} className="text-secondary" />
            </div>
            <div>
              <p className="text-label-sm text-secondary font-bold uppercase tracking-wide">
                Best time to connect
              </p>
              <h2 className="text-headline-md text-on-surface leading-tight">
                {window.best_window}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${confidence.dot}`} />
            <span className="text-[10px] text-on-surface-variant font-medium">
              {confidence.label}
            </span>
          </div>
        </div>

        <p className="text-body-sm text-on-surface-variant leading-relaxed">
          {window.overlap_with_child
            ? "Ah-Ma is typically calm and clear in this window — you're both free."
            : "Ah-Ma's calm window doesn't overlap your schedule today."}
        </p>

        <button
          onClick={handleCallNow}
          disabled={dispatching}
          className="w-full flex items-center justify-center gap-2 bg-secondary text-on-secondary p-3 rounded-xl text-label-md font-bold shadow-sm hover:bg-secondary/90 transition-all active:scale-[0.98] disabled:opacity-70"
        >
          {dispatching ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Phone size={18} />
          )}
          Call now
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 pb-3 flex items-center justify-center gap-1 text-on-surface-variant/70 hover:text-on-surface-variant transition-colors"
      >
        <span className="text-[11px] font-medium">
          {expanded ? "Hide reasoning" : "Why this window?"}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-outline-variant/30 pt-3 fade-in space-y-2">
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            {window.rationale}
          </p>
          {window.evidence.presence_days !== null && (
            <p className="text-body-sm text-on-surface-variant">
              Present {window.evidence.presence_days} of the last{" "}
              {window.evidence.baseline_days} days
              {window.evidence.avg_clarity !== null &&
                ` · clarity ${window.evidence.avg_clarity.toFixed(2)}`}
            </p>
          )}
        </div>
      )}

      {showOverlay && (
        <div className="px-4 pb-4 fade-in">
          <div className="p-3 rounded-xl bg-surface-container border border-secondary/20">
            <div className="flex items-center gap-3">
              {dispatching ? (
                <Loader2 size={20} className="text-secondary animate-spin" />
              ) : (
                <Phone size={20} className="text-secondary" />
              )}
              <div className="flex flex-col">
                <span className="text-label-sm text-secondary font-bold">
                  {dispatching ? "Sending nudge..." : "Connection nudge sent"}
                </span>
                <span className="text-body-sm text-on-surface-variant">
                  {connectionAck?.message_preview ??
                    `Great time to call Ah-Ma (${window.best_window})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
