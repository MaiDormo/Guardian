"use client";

import { AlertTriangle, X } from "lucide-react";
import type { FallPayload } from "../lib/types";

interface FallBannerProps {
  fall: FallPayload | null;
  onDismiss: () => void;
}

export default function FallBanner({ fall, onDismiss }: FallBannerProps) {
  if (!fall) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-[100] slide-down">
      <div className="bg-error text-on-error p-4 flex items-center justify-center shadow-lg">
        <div className="flex items-center justify-between max-w-7xl w-full mx-auto">
          <div className="flex items-center gap-3">
            <AlertTriangle size={28} fill="currentColor" />
            <div className="flex flex-col">
              <span className="text-headline-lg-mobile leading-tight font-bold">FALL DETECTED</span>
              <span className="text-body-sm opacity-90">
                {fall.room.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                {" · "}Prone · {fall.stationary_s}s stationary
              </span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="bg-on-error/20 text-on-error p-2 rounded-full hover:bg-on-error/30 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
