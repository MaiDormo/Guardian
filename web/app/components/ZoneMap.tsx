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

const ROOMS = [
  { id: "bedroom", label: "Bedroom" },
  { id: "bathroom", label: "Bathroom" },
  { id: "living_room", label: "Living Room" },
  { id: "kitchen", label: "Kitchen" },
];

function roomStatusLabel(occupied: boolean, isFall: boolean): string {
  if (isFall) return "fall detected";
  if (occupied) return "occupied";
  return "empty";
}

export default function ZoneMap({ presence }: ZoneMapProps) {
  return (
    <section
      aria-label="Abstract zone map"
      className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-container-low p-3 shadow-panel"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-label-md uppercase text-muted-foreground">
          Abstract Zone Map
        </h2>
        <span className="text-label-sm uppercase text-muted-foreground">
          mmWave presence
        </span>
      </header>

      <div className="grid flex-1 grid-cols-2 gap-2">
        {ROOMS.map((room) => {
          const p = presence[room.id];
          const occupied = p?.occupied || false;
          const isFall = p?.fall || false;
          const Icon = ROOM_ICONS[room.id];
          const status = roomStatusLabel(occupied, isFall);

          return (
            <div
              key={room.id}
              aria-label={`${room.label}: ${status}`}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border bg-card/60 p-3 transition-colors duration-500 ${
                isFall
                  ? "border-alert bg-alert/10"
                  : occupied
                    ? "border-highlight/60 bg-highlight/10"
                    : "border-border"
              }`}
            >
              <span
                aria-hidden="true"
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
                <span className="text-body-sm font-medium text-card-foreground">{room.label}</span>
              </div>
              <span className="sr-only">{status}</span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-label-sm text-pretty text-muted-foreground">
        Auto-mapped from radar zones — no setup
      </p>
    </section>
  );
}
