"use client";

import Image from "next/image";
import { Shield } from "lucide-react";
import type { DispatchChannels, SSEHealth } from "../lib/useSSE";

const AH_MA_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCPDQDaNis2_kUR_JRYlqWsG73aevDS3ReIO7IYZkVLRWRLvC8yW91R09XTfjAfEaIS4-qVdKBp-sqw89txQdV36juDlEyuXLzAV_j-29FdqXCc1tswgfydxmdlpzFP101aDS-UiJoR2xD4qnldm2CI6gQ6rb4imQPGk6CgHtULwLlGc1YWLkiFBckd6TW7X3XdYqAtZ3jeb9Uk9DES7192TAh6m-Ma5_t7obV-uVQFrM75H05ajTv6HZcCAZsEzToXY4ZaZTiszQMf";

interface HeaderProps {
  backendConnected?: boolean;
  sseHealth?: SSEHealth;
  dispatchChannels?: DispatchChannels | null;
}

function dispatchLabel(dispatch: DispatchChannels | null | undefined): string | null {
  if (!dispatch) return null;
  if (dispatch.primary === "wecom") return "WeCom dispatch ready";
  if (dispatch.primary === "whatsapp") return "WhatsApp dispatch ready";
  return "Overlay-only dispatch";
}

function healthStyles(health: SSEHealth, backendConnected: boolean) {
  if (health === "connected" && backendConnected) {
    return {
      chip: "border border-primary/10 bg-primary/[0.04]",
      dot: "bg-ok animate-pulse",
      label: "text-ok",
      telemetry: "Gemma 4 · 0 bytes to cloud",
      srStatus: "Live stream connected. Running on-device with Gemma 4.",
      isLive: true,
    };
  }
  if (health === "reconnecting") {
    return {
      chip: "border border-warn/25 bg-warn/[0.06]",
      dot: "bg-warn animate-pulse",
      label: "text-warn",
      telemetry: "SSE stream retrying",
      srStatus: "Stream reconnecting.",
      isLive: false,
    };
  }
  return {
    chip: "border border-error/20 bg-error/[0.04]",
    dot: "bg-error/80",
    label: "text-error",
    telemetry: "Demo state only",
    srStatus: "Stream offline. Showing demo state only.",
    isLive: false,
  };
}

function BrandLockup() {
  return (
    <div
      className="flex flex-col items-center gap-1 px-0 lg:border-x lg:border-primary/10 lg:px-8"
      aria-hidden="true"
    >
      <Shield className="size-5 text-primary/80" strokeWidth={1.75} aria-hidden="true" />
      <span className="font-display text-balance text-headline-md font-semibold text-primary">
        Guardian
      </span>
      <span className="hidden h-px w-10 bg-primary/25 lg:block" aria-hidden="true" />
      <span className="text-label-sm uppercase tracking-[0.18em] text-muted-foreground">
        On-device care
      </span>
    </div>
  );
}

export default function Header({
  backendConnected = false,
  sseHealth = "disconnected",
  dispatchChannels = null,
}: HeaderProps) {
  const health = healthStyles(sseHealth, backendConnected);
  const dispatch = dispatchLabel(dispatchChannels);
  const liveLabel =
    sseHealth === "connected" && backendConnected
      ? "Live · SSE"
      : sseHealth === "reconnecting"
        ? "Reconnecting…"
        : "Stream offline";

  return (
    <header className="header-masthead flex shrink-0 flex-col overflow-hidden rounded-2xl border border-primary/12">
      <div className="grid grid-cols-1 items-center gap-4 px-4 py-3 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`relative size-12 shrink-0 rounded-full ring-2 ring-primary/15 ring-offset-2 ring-offset-background ${
              health.isLive ? "animate-radar-pulse" : ""
            }`}
          >
            <div className="relative size-full overflow-hidden rounded-full border border-outline-variant shadow-panel">
              <Image
                src={AH_MA_AVATAR}
                alt="Ah-Ma"
                fill
                className="object-cover"
                sizes="48px"
                priority
              />
            </div>
            {health.isLive && (
              <span
                className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-ok"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0 flex flex-col gap-0.5">
            <p className="text-label-sm font-medium uppercase tracking-widest text-muted-foreground">
              Monitored subject
            </p>
            <h1 className="truncate font-display text-balance text-headline-md text-primary leading-tight">
              Ah-Ma
            </h1>
            <p className="truncate text-pretty text-body-sm text-card-foreground">
              Shenzhen · monitored from Hong Kong
            </p>
          </div>
        </div>

        <BrandLockup />

        <div
          className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 lg:max-w-none lg:justify-self-end ${health.chip}`}
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{health.srStatus}</span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className={`size-2 rounded-full ${health.dot}`} />
            <span className={`text-label-sm font-bold uppercase tracking-wide ${health.label}`}>
              {liveLabel}
            </span>
          </div>
          <span className="font-mono text-pretty text-label-sm tabular-nums leading-snug text-muted-foreground">
            {health.telemetry}
          </span>
        </div>
      </div>

      {dispatch && (
        <p
          className={`border-t border-primary/8 bg-surface-container-low/50 px-4 py-1.5 text-label-sm font-medium ${
            dispatchChannels?.primary === "overlay_only" ? "text-muted-foreground" : "text-ok"
          }`}
          role="status"
        >
          {dispatch}
          {dispatchChannels?.auto_dispatch_on_fall && (
            <span className="text-muted-foreground"> · fall auto-dispatch on</span>
          )}
        </p>
      )}
    </header>
  );
}
