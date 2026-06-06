"use client";

import type { PresencePayload } from "../lib/types";

interface FloorPlanProps {
  presence: Record<string, PresencePayload>;
}

const ROOMS = [
  { id: "bedroom", label: "Bedroom", x: "5%", y: "5%", w: "42%", h: "42%" },
  { id: "bathroom", label: "Bathroom", x: "53%", y: "5%", w: "42%", h: "42%" },
  { id: "living_room", label: "Living Room", x: "5%", y: "53%", w: "42%", h: "42%" },
  { id: "kitchen", label: "Kitchen", x: "53%", y: "53%", w: "42%", h: "42%" },
];

export default function FloorPlan({ presence }: FloorPlanProps) {
  return (
    <div className="border border-outline-variant rounded-xl p-lg overflow-hidden bg-surface-container-low">
      <div className="flex justify-between items-center mb-md">
        <h2 className="text-headline-md text-on-surface">Floor Plan</h2>
        <span className="text-label-sm text-on-surface-variant">LIVE</span>
      </div>
      <div className="relative w-full aspect-square bg-surface-container-low rounded-lg overflow-hidden">
        {ROOMS.map((room) => {
          const p = presence[room.id];
          const occupied = p?.occupied || false;
          const isFall = p?.fall || false;

          return (
            <div
              key={room.id}
              className="absolute border border-outline-variant/50 rounded-lg flex flex-col items-center justify-center transition-all duration-500"
              style={{ left: room.x, top: room.y, width: room.w, height: room.h }}
            >
              <span className="text-body-sm text-on-surface-variant font-medium">{room.label}</span>
              {occupied && (
                <div
                  className={`mt-2 w-4 h-4 rounded-full transition-all duration-300 ${
                    isFall ? "bg-error pulse-red" : "bg-primary"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
