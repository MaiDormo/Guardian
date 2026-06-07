"use client";

import { BedDouble, ShowerHead, Sofa, CookingPot, type LucideIcon } from "lucide-react";
import type { PresencePayload } from "../lib/types";

interface ZoneMapProps {
  presence: Record<string, PresencePayload>;
}

const ROOM_ICONS: Record<string, LucideIcon> = {
  bedroom: BedDouble,
  bathroom: ShowerHead,
  living_room: Sofa,
  kitchen: CookingPot,
};

// 2x2 grid order matching the PRD §10.1 Abstract Zone Map sketch.
const ROOMS = [
  { id: "bedroom", label: "Bedroom" },
  { id: "bathroom", label: "Bathroom" },
  { id: "living_room", label: "Living Room" },
  { id: "kitchen", label: "Kitchen" },
];

export default function ZoneMap({ presence }: ZoneMapProps) {
  return (
    <section
      aria-label="Abstract zone map"
      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card/60 p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Abstract Zone Map
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          mmWave presence
        </span>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-2">
        {ROOMS.map((room) => {
          const p = presence[room.id];
          const occupied = p?.occupied || false;
          const isFall = p?.fall || false;
          const Icon = ROOM_ICONS[room.id];

          return (
            <div
              key={room.id}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border bg-card/60 p-3 transition-colors duration-500 ${
                isFall
                  ? "border-alert bg-alert/10"
                  : occupied
                    ? "border-highlight/60 bg-highlight/10"
                    : "border-border"
              }`}
            >
              <span
                className={`flex size-8 items-center justify-center rounded-full transition-all duration-500 ${
                  isFall
                    ? "bg-alert/30 animate-radar-pulse-red"
                    : occupied
                      ? "bg-highlight/30 animate-radar-pulse"
                      : "bg-muted"
                }`}
              >
                <span
                  className={`size-2.5 rounded-full transition-colors duration-500 ${
                    isFall ? "bg-alert" : occupied ? "bg-highlight" : "bg-muted-foreground/40"
                  }`}
                />
              </span>
              <div className="flex items-center gap-1.5">
                <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span className="text-xs font-medium text-card-foreground">{room.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] leading-tight text-muted-foreground">
        Auto-mapped from radar zones — no setup
      </p>
    </section>
  );
}
