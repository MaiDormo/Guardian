"use client";

interface HeaderProps {
  backendConnected?: boolean;
}

export default function Header({ backendConnected = false }: HeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-card-foreground">Guardian</h1>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Ah-Ma · Shenzhen — monitored from Hong Kong
        </span>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
          backendConnected
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-border bg-card text-muted-foreground"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${
            backendConnected ? "bg-ok animate-pulse" : "bg-muted-foreground/40"
          }`}
        />
        {backendConnected ? "Running On-Device · Gemma 4 · 0 Bytes to Cloud" : "Connecting…"}
      </div>
    </header>
  );
}
