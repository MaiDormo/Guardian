"use client";

import type { LocationUpdatePayload, WanderingPayload } from "../lib/types";

interface LocationMapProps {
  location: LocationUpdatePayload | null;
  wandering: WanderingPayload | null;
}

const NODES = [
  { id: "home", label: "Home", x: 170, y: 160 },
  { id: "market", label: "Wet Market", x: 337, y: 65 },
  { id: "dimsum", label: "Dim Sum", x: 45, y: 35 },
  { id: "mtr", label: "MTR", x: 30, y: 185 },
];

export default function LocationMap({ location, wandering }: LocationMapProps) {
  const isWandering = wandering !== null;

  return (
    <section
      aria-label="GBA trajectory map"
      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card/60 p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          GBA Trajectory Map
        </h2>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isWandering ? "bg-alert/20 text-alert" : "bg-ok/15 text-ok"
          }`}
        >
          {isWandering ? "Wandering" : "In footprint"}
        </span>
      </header>

      <div className="relative flex-1 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low">
        <svg
          viewBox="0 0 400 300"
          className="h-full w-full"
          role="img"
          aria-label={
            isWandering
              ? "Anomalous wandering trajectory outside the established footprint"
              : "Normal daily footprint within the established trajectory"
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

          {/* Normal footprint — hand-drawn route, neutral/green */}
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

          {/* Anomalous trace — pre-baked red wandering path, revealed on event */}
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

          {/* Named nodes */}
          {NODES.map((n) => (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.id === "home" ? 6 : 3.5}
                fill={n.id === "home" ? "#006948" : "#6d7a72"}
                className={n.id === "home" && isWandering ? "animate-blink-pin" : ""}
              />
              <text
                x={n.x}
                y={n.y - 11}
                textAnchor="middle"
                fontSize="9"
                fill="#6d7a72"
                fontFamily="ui-monospace, monospace"
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>

        {wandering && (
          <div className="absolute bottom-3 left-3 rounded-lg bg-alert/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <p className="text-[11px] font-bold text-alert-foreground">
              {wandering.minutes_outside_baseline_footprint} min outside
            </p>
            <p className="text-[9px] text-alert-foreground/80">
              density {wandering.trajectory_density_score.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-mono">
          density {location ? location.trajectory_density_score.toFixed(2) : "—"}
        </span>
        <span className="font-mono">
          {location ? `${location.distance_from_home_m}m from home` : "awaiting GPS…"}
        </span>
      </div>
    </section>
  );
}
