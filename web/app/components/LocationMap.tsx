"use client";

import { useState } from "react";
import type { LocationUpdatePayload, WanderingPayload } from "../lib/types";
import {
  formatDistanceFromHome,
  formatRouteFamiliarityPercent,
  formatUsualArea,
} from "../lib/friendlyMetrics";

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

/** Deviation polyline: Home → Wet Market → east endpoint (named nodes only). */
const DEVIATION_PATH = "M170 160 L260 105 L337 65 L350 160 L310 230";
const DEVIATION_ENDPOINT = { x: 310, y: 230 };

function humanStatus(isWandering: boolean, location: LocationUpdatePayload | null): string {
  if (isWandering) return "Outside usual route";
  if (location?.distance_from_home_m === 0) {
    return "At home — within usual routine";
  }
  return "Following usual routine";
}

function matchPercent(
  location: LocationUpdatePayload | null,
  wandering: WanderingPayload | null
): string | null {
  const score = location?.trajectory_density_score ?? wandering?.trajectory_density_score;
  if (score == null) return null;
  return `${Math.round(score * 100)}% match to usual pattern`;
}

function footerText(
  matchLabel: string | null,
  isWandering: boolean
): string {
  if (matchLabel) return matchLabel;
  if (isWandering) return "Route deviation detected";
  return "Learning usual pattern…";
}

function densityScore(
  location: LocationUpdatePayload | null,
  wandering: WanderingPayload | null
): number | null | undefined {
  return location?.trajectory_density_score ?? wandering?.trajectory_density_score;
}

function clusterMatch(
  location: LocationUpdatePayload | null,
  wandering: WanderingPayload | null
): boolean | null | undefined {
  return location?.baseline_cluster_match ?? wandering?.baseline_cluster_match;
}

export default function LocationMap({ location, wandering }: LocationMapProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isWandering = wandering !== null;
  const statusLabel = humanStatus(isWandering, location);
  const matchLabel = matchPercent(location, wandering);
  const detailsId = "location-raw-details";
  const wanderingKey = wandering?.updated_at ?? "none";

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
            <pattern id="loc-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#bccac0" strokeWidth="0.5" />
            </pattern>
          </defs>

          <rect width="400" height="300" fill="url(#loc-grid)" />

          {/* Usual weekly loop: Home → Dim Sum → MTR → Home (static dashes) */}
          <g className={`transition-opacity duration-300 ${isWandering ? "opacity-60" : "opacity-100"}`}>
            <path
              d="M170 160 Q110 95 45 35 Q-10 110 30 185 Q90 230 170 160 Z"
              fill="none"
              stroke="#006948"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="6 6"
            />
          </g>

          {/* Occasional Wet Market visit */}
          <g className={`transition-opacity duration-300 ${isWandering ? "opacity-40" : "opacity-70"}`}>
            <path
              d="M170 160 Q260 100 337 65"
              fill="none"
              stroke="#6d7a72"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 6"
            />
          </g>

          {isWandering && (
            <g key={wanderingKey} className="animate-fade-in-once">
              <path
                d={DEVIATION_PATH}
                fill="none"
                stroke="#ba1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="animate-path-reveal"
              />
              <circle
                cx={DEVIATION_ENDPOINT.x}
                cy={DEVIATION_ENDPOINT.y}
                r={5}
                fill="#ba1a1a"
                className="animate-dot-attention"
              />
            </g>
          )}

          {CORE_NODES.map((n) => (
            <g key={n.id}>
              {n.kind === "home" && isWandering && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={10}
                  fill="none"
                  stroke="#ba1a1a"
                  strokeWidth={1}
                  opacity={0.3}
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.kind === "home" ? 6 : 3.5}
                fill={n.kind === "home" ? "#006948" : "#6d7a72"}
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
        {isWandering && (
          <>
            {" "}
            ·{" "}
            <span className="inline-block size-2 rounded-full bg-alert align-middle" aria-hidden="true" />{" "}
            red = today&apos;s path
          </>
        )}
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-label-sm text-muted-foreground">
          <span className="text-pretty">{footerText(matchLabel, isWandering)}</span>
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
            <dt>Route familiarity</dt>
            <dd className="text-right text-card-foreground">
              {formatRouteFamiliarityPercent(densityScore(location, wandering)) ?? "—"}
            </dd>
            <dt>From home</dt>
            <dd className="text-right text-card-foreground">
              {formatDistanceFromHome(location?.distance_from_home_m)}
            </dd>
            <dt>Usual area</dt>
            <dd className="text-right text-card-foreground">
              {formatUsualArea(clusterMatch(location, wandering))}
            </dd>
            {(location?.updated_at ?? wandering?.updated_at) && (
              <>
                <dt>Updated</dt>
                <dd className="text-right text-card-foreground">
                  {new Date((location?.updated_at ?? wandering?.updated_at)!).toLocaleTimeString([], {
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
