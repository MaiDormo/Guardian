"use client";

import { Home, History, Radio, User } from "lucide-react";

const NAV_ITEMS = [
  { label: "Home", icon: Home, active: true },
  { label: "Timeline", icon: History, active: false },
  { label: "Sensors", icon: Radio, active: false },
  { label: "Profile", icon: User, active: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 w-full z-50 rounded-t-xl bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 shadow-lg flex justify-around items-center h-20 px-4 pb-4 md:hidden">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className={`flex flex-col items-center justify-center px-4 py-1 transition-transform active:scale-90 duration-200 ${
              item.active
                ? "bg-primary-container text-on-primary-container rounded-full"
                : "text-on-surface-variant"
            }`}
          >
            <Icon size={22} />
            <span className="text-label-sm mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
