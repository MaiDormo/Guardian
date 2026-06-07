"use client";

import { useEffect, useState } from "react";
import { X, PhoneCall, CheckCircle2, AlertTriangle, Sun, Info } from "lucide-react";
import type { ToastEvent, ToastType } from "../lib/types";

interface ToastItemProps {
  toast: ToastEvent;
  onDismiss: (id: string) => void;
}

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "scenario":
      return <Play size={16} className="text-primary" />;
    case "intervention":
      return <PhoneCall size={16} className="text-error" />;
    case "fall":
      return <AlertTriangle size={16} className="text-error" />;
    case "connection":
      return <Sun size={16} className="text-amber-500" />;
    default:
      return <Info size={16} className="text-primary" />;
  }
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const borderColor = {
    scenario: "border-l-primary",
    intervention: "border-l-error",
    fall: "border-l-error",
    connection: "border-l-amber-400",
    info: "border-l-primary",
  }[toast.type];

  return (
    <div
      className={`flex items-start gap-3 bg-surface/95 backdrop-blur-md border border-outline-variant/50 shadow-lg rounded-xl p-3.5 transition-all duration-300 border-l-4 ${borderColor} ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <ToastIcon type={toast.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-label-sm text-on-surface font-bold truncate">{toast.title}</p>
        <p className="text-body-sm text-on-surface-variant line-clamp-2">{toast.message}</p>
      </div>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="shrink-0 text-on-surface-variant/60 hover:text-on-surface transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastEvent[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {[...toasts].reverse().slice(0, 5).map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Play({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}
