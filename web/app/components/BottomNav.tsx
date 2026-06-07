"use client";

import { Home, History, Radio, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, active: true, disabled: false },
  { label: "Timeline", icon: History, active: false, disabled: true },
  { label: "Sensors", icon: Radio, active: false, disabled: true },
  { label: "Profile", icon: User, active: false, disabled: true },
];

export default function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around rounded-t-xl border-t border-outline-variant/30 bg-surface/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-xl lg:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            aria-label={item.disabled ? `${item.label} (coming soon)` : item.label}
            aria-current={item.active ? "page" : undefined}
            className={`flex flex-col items-center justify-center px-4 py-1 transition-transform duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              item.active
                ? "rounded-full bg-primary-container text-on-primary-container"
                : "text-on-surface-variant"
            }`}
          >
            <Icon size={22} aria-hidden="true" />
            <span className="mt-0.5 text-label-sm">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
