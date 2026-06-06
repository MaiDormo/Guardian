"use client";

import { Bell } from "lucide-react";

export default function Header() {
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
      <button className="text-primary hover:opacity-80 transition-opacity active:scale-95">
        <Bell size={24} />
      </button>
    </header>
  );
}
