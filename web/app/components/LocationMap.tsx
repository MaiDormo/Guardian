"use client";

import type { LocationUpdatePayload, WanderingPayload } from "../lib/types";

interface LocationMapProps {
  location: LocationUpdatePayload | null;
  wandering: WanderingPayload | null;
}

export default function LocationMap({ location, wandering }: LocationMapProps) {
  const isWandering = wandering !== null;

  return (
    <div className="border border-outline-variant rounded-xl p-lg overflow-hidden bg-surface-container-low">
      <div className="flex justify-between items-center mb-md">
        <h2 className="text-headline-md text-on-surface">Map</h2>
        <div className="flex items-center gap-2">
          {isWandering && (
            <>
              <span className="w-2 h-2 rounded-full bg-error pulse-red" />
              <span className="text-label-sm text-error font-bold">LIVE ALERT</span>
            </>
          )}
          {!isWandering && (
            <span className="text-label-sm text-primary font-bold">GPS ACTIVE</span>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-[4/3] bg-surface-container rounded-lg overflow-hidden">
        <svg viewBox="0 0 400 300" className="w-full h-full">
          {/* Background grid streets */}
          <rect width="400" height="300" fill="#e5eeff" />

          {/* Streets */}
          <line x1="0" y1="80" x2="400" y2="80" stroke="#d3e4fe" strokeWidth="3" />
          <line x1="0" y1="160" x2="400" y2="160" stroke="#d3e4fe" strokeWidth="3" />
          <line x1="0" y1="240" x2="400" y2="240" stroke="#d3e4fe" strokeWidth="3" />
          <line x1="130" y1="0" x2="130" y2="300" stroke="#d3e4fe" strokeWidth="3" />
          <line x1="270" y1="0" x2="270" y2="300" stroke="#d3e4fe" strokeWidth="3" />

          {/* Landmarks */}
          <rect x="15" y="15" width="30" height="20" rx="3" fill="#c8e6c9" />
          <text x="30" y="28" textAnchor="middle" fill="#2e7d32" fontSize="6" fontWeight="600">PARK</text>

          <rect x="15" y="175" width="30" height="20" rx="3" fill="#fff3e0" />
          <text x="30" y="188" textAnchor="middle" fill="#e65100" fontSize="6" fontWeight="600">MTR</text>

          <rect x="320" y="55" width="35" height="20" rx="3" fill="#fff9c4" />
          <text x="337" y="68" textAnchor="middle" fill="#f57f17" fontSize="6" fontWeight="600">MARKET</text>

          <rect x="320" y="215" width="35" height="20" rx="3" fill="#fce4ec" />
          <text x="337" y="228" textAnchor="middle" fill="#c62828" fontSize="6" fontWeight="600">CLINIC</text>

          {/* Home base */}
          <rect x="152" y="142" width="36" height="36" rx="4" fill="#006948" />
          <text x="170" y="165" textAnchor="middle" fill="white" fontSize="8" fontWeight="600">HOME</text>

          {/* Normal path (green dashed) */}
          {!isWandering && (
            <path
              d="M 170 160 Q 100 120 45 35"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              opacity="0.6"
            />
          )}

          {/* Wandering trace (red glow) */}
          {isWandering && (
            <>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M 170 160 Q 230 100 300 70 Q 350 90 340 180 Q 320 260 280 220"
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeDasharray="6 4"
                opacity="0.85"
                filter="url(#glow)"
              />
              {/* Anomalous markers */}
              <circle cx="280" cy="220" r="4" fill="#ef4444" opacity="0.7" />
              <circle cx="340" cy="180" r="3" fill="#ef4444" opacity="0.5" />
              <circle cx="300" cy="70" r="3" fill="#ef4444" opacity="0.5" />
            </>
          )}

          {/* Location pin */}
          <g transform="translate(170, 160)">
            <path d="M0-18C-9-18-18-9-18 0C-18 12 0 28 0 28C0 28 18 12 18 0C18-9 9-18 0-18Z"
                  fill={isWandering ? "#ef4444" : "#006948"} opacity="0.12" />
            <circle cx="0" cy="0" r="7" fill={isWandering ? "#ef4444" : "#006948"}
                    className={isWandering ? "animate-blink-pin" : ""} />
            <circle cx="0" cy="0" r="3" fill="white" />
          </g>
        </svg>

        {/* GPS badge */}
        <div className="absolute bottom-3 right-3 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full border border-outline-variant shadow-sm">
          <span className="text-label-sm text-primary font-bold">GPS ACTIVE</span>
        </div>

        {/* Wandering badge */}
        {wandering && (
          <div className="absolute bottom-3 left-3 bg-error/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
            <p className="text-label-sm text-on-error font-bold">
              {wandering.minutes_outside_baseline_footprint} min outside
            </p>
            <p className="text-[9px] text-on-error/80">
              density {wandering.trajectory_density_score.toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
