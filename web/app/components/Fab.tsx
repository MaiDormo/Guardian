"use client";

import { PhoneCall, Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface FabProps {
  onDispatch: () => void;
  dispatching: boolean;
  dispatched: boolean;
}

export default function Fab({ onDispatch, dispatching, dispatched }: FabProps) {
  if (dispatched) return null;

  return (
    <button
      onClick={onDispatch}
      disabled={dispatching}
      className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 hover:shadow-2xl disabled:opacity-70 z-40"
    >
      {dispatching ? (
        <Loader2 size={28} className="animate-spin" />
      ) : (
        <PhoneCall size={28} />
      )}
    </button>
  );
}
