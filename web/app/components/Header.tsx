"use client";

import { Bell } from "lucide-react";

interface HeaderProps {
  backendConnected?: boolean;
}

export default function Header({ backendConnected = false }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm flex items-center justify-between px-gutter h-16">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant bg-surface-container-high flex items-center justify-center text-primary font-bold text-sm">
          GW
        </div>
        <div className="flex flex-col">
          <h1 className="text-headline-md leading-none text-primary">Grandma Wong</h1>
          <span className="text-label-sm text-on-surface-variant">Elderly Care Monitor</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
            backendConnected
              ? "bg-primary-container/50 border-primary/20 text-primary"
              : "bg-surface-container border-outline-variant text-on-surface-variant"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendConnected ? "bg-primary animate-pulse" : "bg-outline-variant"
            }`}
          />
          {backendConnected ? "On-Device · 0 bytes to cloud" : "Connecting…"}
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="text-primary hover:opacity-80 transition-opacity active:scale-95"
        >
          <Bell size={24} />
        </button>
      </div>
    </header>
  );
}
