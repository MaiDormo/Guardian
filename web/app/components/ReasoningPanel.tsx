"use client";

import { useEffect, useRef } from "react";
import { Play, Loader2 } from "lucide-react";
import type { ReasoningPayload } from "../lib/types";
import type { SSEHealth } from "../lib/useSSE";
import { formatSignalLabel } from "../lib/signals";
import {
  formatPatternMatchConsole,
  humanizeFeatures,
} from "../lib/friendlyMetrics";

interface ReasoningPanelProps {
  reasoning: ReasoningPayload[];
  onRunNormalMorning?: () => void;
  scenarioLoading?: boolean;
  sseHealth?: SSEHealth;
}

const VERDICT_GLYPH: Record<"red" | "amber" | "green", { glyph: string; cls: string }> = {
  red: { glyph: "●", cls: "text-error" },
  amber: { glyph: "●", cls: "text-warn" },
  green: { glyph: "●", cls: "text-primary-fixed" },
};

function inferState(r: ReasoningPayload): "red" | "amber" | "green" {
  if (typeof r.cosine_distance === "number") {
    if (r.cosine_distance >= 0.25) return "red";
    if (r.cosine_distance >= 0.12) return "amber";
  }
  return "green";
}

function ReasoningEntry({ r }: { r: ReasoningPayload }) {
  const state = inferState(r);
  const v = VERDICT_GLYPH[state];

  return (
    <div className="border-b border-inverse-on-surface/15 pb-2">
      <div className="text-label-sm leading-relaxed text-inverse-on-surface/80">
        <span className="text-primary-fixed">&lt;context&gt;</span> signal={r.signal}
        {formatPatternMatchConsole(r.cosine_distance) && (
          <> · pattern={formatPatternMatchConsole(r.cosine_distance)}</>
        )}
        {typeof r.baseline_window_days === "number" && (
          <> · baseline={r.baseline_window_days}d</>
        )}
        <br />
        <span className="pl-[58px]">
          checked=[{humanizeFeatures(r.features_considered ?? [])}]
        </span>{" "}
        <span className="text-primary-fixed">&lt;/context&gt;</span>
      </div>
      <div className="mt-1 text-body-sm leading-relaxed text-inverse-on-surface">
        <span className={`mr-1.5 font-bold ${v.cls}`} aria-hidden="true">
          {v.glyph}
        </span>
        <span className={`font-semibold ${v.cls}`}>{formatSignalLabel(r.signal).toLowerCase()}</span>{" "}
        {r.rationale}
      </div>
    </div>
  );
}

function ExampleEntry() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-label-sm font-bold uppercase text-inverse-on-surface/50 ring-1 ring-inverse-on-surface/20">
          Example
        </span>
      </div>
      <div className="text-label-sm leading-relaxed text-inverse-on-surface/50">
        <span className="text-primary-fixed/70">&lt;context&gt;</span> signal=woke_up · pattern=usual ·
        baseline=14d
        <br />
        <span className="pl-[58px]">checked=[wake time, motion]</span>{" "}
        <span className="text-primary-fixed/70">&lt;/context&gt;</span>
      </div>
      <div className="text-body-sm leading-relaxed text-inverse-on-surface/50">
        <span className="mr-1.5 font-bold text-primary-fixed/70" aria-hidden="true">
          ●
        </span>
        <span className="font-semibold text-primary-fixed/70">woke up</span> — Within baseline. Ah-Ma
        rose at 06:42, consistent with 14-day pattern.
      </div>
    </div>
  );
}

function healthFooterLabel(health: SSEHealth): string {
  switch (health) {
    case "connected":
      return "Live · SSE";
    case "reconnecting":
      return "Reconnecting…";
    case "disconnected":
      return "Stream offline · demo state only";
  }
}

function healthFooterDot(health: SSEHealth): string {
  switch (health) {
    case "connected":
      return "bg-primary-fixed animate-pulse";
    case "reconnecting":
      return "bg-warn animate-pulse";
    case "disconnected":
      return "bg-error/80";
  }
}

export default function ReasoningPanel({
  reasoning,
  onRunNormalMorning,
  scenarioLoading = false,
  sseHealth = "disconnected",
}: ReasoningPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "end",
    });
  }, [reasoning.length]);

  const isEmpty = reasoning.length === 0;

  return (
    <section
      aria-label="Reasoning console"
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-inverse-on-surface/15 bg-inverse-surface shadow-panel"
    >
      <header className="console-header-glow flex items-center justify-between border-b border-inverse-on-surface/15 px-3 py-2.5">
        <h2 className="font-mono text-label-md uppercase text-inverse-on-surface">
          Reasoning Console
        </h2>
        <span className="flex items-center gap-1.5 text-label-sm text-inverse-on-surface/70">
          <span className="size-1.5 animate-pulse rounded-full bg-primary-fixed" aria-hidden="true" />
          gemma 4 · on-device
        </span>
      </header>

      <div className="console-terminal-bg flex-1 space-y-3 overflow-y-auto p-3 font-mono">
        {isEmpty ? (
          <>
            <ExampleEntry />
            {onRunNormalMorning && (
              <button
                type="button"
                onClick={onRunNormalMorning}
                disabled={scenarioLoading}
                aria-busy={scenarioLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-70"
              >
                {scenarioLoading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="size-4" fill="currentColor" aria-hidden="true" />
                )}
                Run Normal Morning
              </button>
            )}
          </>
        ) : (
          reasoning.map((r, i) => <ReasoningEntry key={`${r.signal}-${r.updated_at}-${i}`} r={r} />)
        )}
        <div ref={endRef} />
      </div>

      <footer
        className="flex items-center gap-2 border-t border-inverse-on-surface/15 px-3 py-2"
        role="status"
        aria-live="polite"
      >
        <span className={`size-2 rounded-full ${healthFooterDot(sseHealth)}`} aria-hidden="true" />
        <span className="font-mono text-label-sm font-medium text-inverse-on-surface/70">
          {healthFooterLabel(sseHealth)}
        </span>
      </footer>
    </section>
  );
}
