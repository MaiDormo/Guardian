"use client";

import { useEffect, useRef } from "react";
import type { ReasoningPayload } from "../lib/types";
import { formatSignalLabel } from "../lib/signals";

interface ReasoningPanelProps {
  reasoning: ReasoningPayload[];
}

const VERDICT_GLYPH: Record<"red" | "amber" | "green", { glyph: string; cls: string }> = {
  red: { glyph: "●", cls: "text-error" },
  amber: { glyph: "●", cls: "text-amber-400" },
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
    <div className="border-b border-border/40 pb-2">
      {/* <context> block — auditable inputs in, never the verdict */}
      <div className="text-[11px] leading-relaxed text-muted-foreground">
        <span className="text-primary-fixed">&lt;context&gt;</span> signal={r.signal}
        {typeof r.cosine_distance === "number" && <> · cosine={r.cosine_distance.toFixed(2)}</>}
        {typeof r.baseline_window_days === "number" && <> · window={r.baseline_window_days}d</>}
        <br />
        <span className="pl-[58px]">
          features=[{(r.features_considered ?? []).join(", ")}]
        </span>{" "}
        <span className="text-primary-fixed">&lt;/context&gt;</span>
      </div>
      {/* verdict line — Gemma's judgement out, one line, plain language */}
      <div className="mt-1 text-[12px] leading-relaxed text-card-foreground">
        <span className={`mr-1.5 font-bold ${v.cls}`}>{v.glyph}</span>
        <span className={`font-semibold ${v.cls}`}>{formatSignalLabel(r.signal).toLowerCase()}</span>{" "}
        {r.rationale}
      </div>
    </div>
  );
}

export default function ReasoningPanel({ reasoning }: ReasoningPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [reasoning.length]);

  return (
    <section
      aria-label="Reasoning console"
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-inverse-surface"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Reasoning Console
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary-fixed" />
          gemma 4 · on-device
        </span>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-3 font-mono">
        {reasoning.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/70">
            Awaiting signal synthesis… run a scenario to stream Gemma&apos;s on-device verdicts.
          </p>
        ) : (
          reasoning.map((r, i) => <ReasoningEntry key={`${r.signal}-${r.updated_at}-${i}`} r={r} />)
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}
