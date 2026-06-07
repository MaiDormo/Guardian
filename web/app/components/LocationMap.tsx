"use client";

import { useState } from "react";
import type { LocationUpdatePayload, WanderingPayload } from "../lib/types";

interface LocationMapProps {
  location: LocationUpdatePayload | null;
  wandering: WanderingPayload | null;
}

const CORE_NODES = [
  { id: "home", label: "Home", x: 170, y: 160, kind: "home" as const },
  { id: "dimsum", label: "Dim Sum", x: 45, y: 35, kind: "core" as const },
  { id: "mtr", label: "MTR", x: 30, y: 185, kind: "core" as const },
];

const OCCASIONAL_NODES = [
  { id: "market", label: "Wet Market", x: 337, y: 65 },
];

function humanStatus(isWandering: boolean, location: LocationUpdatePayload | null): string {
  if (isWandering) return "Outside usual route";
  if (location?.distance_from_home_m === 0) {
    return "At home — within usual routine";
  }
  return "Following usual routine";
}

function matchPercent(location: LocationUpdatePayload | null): string | null {
  if (!location) return null;
  return `${Math.round(location.trajectory_density_score * 100)}% match to usual pattern`;
}

export default function LocationMap({ location, wandering }: LocationMapProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isWandering = wandering !== null;
  const statusLabel = humanStatus(isWandering, location);
  const matchLabel = matchPercent(location);
  const detailsId = "location-raw-details";

  return (
    <section
      aria-label="Daily route check"
      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-container-low p-3 shadow-panel"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-label-md uppercase text-muted-foreground">Daily Route Check</h2>
            <p className="text-label-sm text-muted-foreground">Ah-Ma&apos;s usual week in Shenzhen</p>
          </div>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-label-sm font-semibold ${
              isWandering ? "bg-alert/20 text-alert" : "bg-ok/15 text-ok"
            }`}
            role="status"
            aria-live="polite"
          >
            {isWandering ? "Outside route" : "Usual routine"}
          </span>
        </div>
        <p className="text-pretty text-body-sm text-card-foreground">{statusLabel}</p>
      </header>

      <div className="relative min-h-[140px] flex-1 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low">
        <svg
          viewBox="0 0 400 300"
          className="h-full w-full"
          role="img"
          aria-label={
            isWandering
              ? "Anomalous route outside Ah-Ma's usual Dim Sum and MTR routine"
              : "Ah-Ma is within her usual home, Dim Sum, and MTR routine"
          }
        >
          <defs>
            <filter id="loc-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="loc-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#bccac0" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width="400" height="300" fill="url(#loc-grid)" />

          {/* Usual weekly loop: Home → Dim Sum → MTR → Home */}
          <g className={`transition-opacity duration-700 ${isWandering ? "opacity-25" : "opacity-100"}`}>
            <path
              d="M170 160 Q110 95 45 35 Q-10 110 30 185 Q90 230 170 160 Z"
              fill="none"
              stroke="#006948"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="1 7"
              className="animate-dash-flow"
            />
          </g>

          {/* Occasional Wet Market visit — dashed, not part of daily loop */}
          <g className={`transition-opacity duration-700 ${isWandering ? "opacity-20" : "opacity-70"}`}>
            <path
              d="M170 160 Q260 100 337 65"
              fill="none"
              stroke="#6d7a72"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
            />
          </g>

          <g className={`transition-opacity duration-700 ${isWandering ? "opacity-100 animate-pulse" : "opacity-0"}`}>
            <path
              d="M170 160 Q230 100 300 70 Q350 90 340 180 Q320 260 280 220"
              fill="none"
              stroke="#ba1a1a"
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#loc-glow)"
            />
            <circle cx="280" cy="220" r="5" fill="#ba1a1a" filter="url(#loc-glow)" />
            <circle cx="340" cy="180" r="3.5" fill="#ba1a1a" opacity="0.6" />
            <circle cx="300" cy="70" r="3.5" fill="#ba1a1a" opacity="0.6" />
          </g>

          {CORE_NODES.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.kind === "home" ? 6 : 3.5}
                fill={n.kind === "home" ? "#006948" : "#6d7a72"}
                className={n.kind === "home" && isWandering ? "animate-blink-pin" : ""}
              />
              <text
                x={n.x}
                y={n.y - 11}
                textAnchor="middle"
                fontSize="10"
                fill="#6d7a72"
                fontFamily="ui-monospace, monospace"
              >
                {n.label}
              </text>
            </g>
          ))}

          {OCCASIONAL_NODES.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={3.5} fill="#6d7a72" opacity="0.7" />
              <text
                x={n.x}
                y={n.y - 11}
                textAnchor="middle"
                fontSize="10"
                fill="#6d7a72"
                fontFamily="ui-monospace, monospace"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>

        {wandering && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-alert/90 px-3 py-1.5 shadow-sm">
            <p className="text-label-sm font-bold text-alert-foreground">
              {wandering.minutes_outside_baseline_footprint} min outside usual route
            </p>
          </div>
        )}
      </div>

      <p className="text-label-sm text-pretty text-muted-foreground">
        <span className="inline-block size-2 rounded-full bg-ok align-middle" aria-hidden="true" />{" "}
        Green loop = usual week ·{" "}
        <span className="inline-block size-2 rounded-full bg-muted-foreground/60 align-middle" aria-hidden="true" />{" "}
        grey dash = occasional visit
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-label-sm text-muted-foreground">
          <span className="text-pretty">
            {matchLabel ?? "Learning usual pattern…"}
          </span>
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            className="font-mono text-label-sm tabular-nums text-muted-foreground/80 underline-offset-2 hover:underline"
          >
            {detailsOpen ? "Hide" : "Details"}
          </button>
        </div>

        {detailsOpen && (
          <dl
            id={detailsId}
            className="fade-in grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-border/50 bg-surface-container p-2 font-mono text-label-sm tabular-nums text-muted-foreground"
          >
            <dt>Density score</dt>
            <dd className="text-right text-card-foreground">
              {location?.trajectory_density_score.toFixed(2) ?? "—"}
            </dd>
            <dt>Distance from home</dt>
            <dd className="text-right text-card-foreground">
              {location != null ? `${location.distance_from_home_m}m` : "—"}
            </dd>
            <dt>Baseline cluster</dt>
            <dd className="text-right text-card-foreground">
              {location == null
                ? "—"
                : location.baseline_cluster_match
                  ? "Match"
                  : "No match"}
            </dd>
            {location?.updated_at && (
              <>
                <dt>Updated</dt>
                <dd className="text-right text-card-foreground">
                  {new Date(location.updated_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}
