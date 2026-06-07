"use client";

import Image from "next/image";
import { Play, Loader2 } from "lucide-react";
import type { DispatchChannels, SSEHealth } from "../lib/useSSE";

const AH_MA_AVATAR =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCPDQDaNis2_kUR_JRYlqWsG73aevDS3ReIO7IYZkVLRWRLvC8yW91R09XTfjAfEaIS4-qVdKBp-sqw89txQdV36juDlEyuXLzAV_j-29FdqXCc1tswgfydxmdlpzFP101aDS-UiJoR2xD4qnldm2CI6gQ6rb4imQPGk6CgHtULwLlGc1YWLkiFBckd6TW7X3XdYqAtZ3jeb9Uk9DES7192TAh6m-Ma5_t7obV-uVQFrM75H05ajTv6HZcCAZsEzToXY4ZaZTiszQMf";

interface HeaderProps {
  backendConnected?: boolean;
  sseHealth?: SSEHealth;
  dispatchChannels?: DispatchChannels | null;
  onRunNormalMorning?: () => void;
  scenarioLoading?: boolean;
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
      container: "border-ok/40 bg-ok/10 text-ok",
      dot: "bg-ok animate-pulse",
      label: "Live · SSE",
      detail: "Running On-Device · Gemma 4 · 0 Bytes to Cloud",
      srStatus: "Live stream connected. Running on-device with Gemma 4.",
    };
  }
  if (health === "reconnecting") {
    return {
      container: "border-warn/40 bg-warn/10 text-warn",
      dot: "bg-warn animate-pulse",
      label: "Reconnecting…",
      detail: "SSE stream retrying",
      srStatus: "Stream reconnecting.",
    };
  }
  return {
    container: "border-error/30 bg-error/5 text-error",
    dot: "bg-error/80",
    label: "Stream offline",
    detail: "Demo state only",
    srStatus: "Stream offline. Showing demo state only.",
  };
}

export default function Header({
  backendConnected = false,
  sseHealth = "disconnected",
  dispatchChannels = null,
  onRunNormalMorning,
  scenarioLoading = false,
}: HeaderProps) {
  const health = healthStyles(sseHealth, backendConnected);
  const dispatch = dispatchLabel(dispatchChannels);

  return (
    <header className="flex shrink-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-outline-variant shadow-panel">
          <Image
            src={AH_MA_AVATAR}
            alt="Ah-Ma"
            fill
            className="object-cover"
            sizes="40px"
            priority
          />
        </div>
        <div className="min-w-0 flex flex-col">
          <p className="text-label-sm font-medium uppercase text-muted-foreground">Guardian</p>
          <h1 className="truncate font-display text-balance text-headline-md text-primary leading-tight">
            Ah-Ma
          </h1>
          <p className="truncate text-body-sm text-card-foreground">
            Shenzhen · monitored from Hong Kong
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onRunNormalMorning && (
          <button
            type="button"
            onClick={onRunNormalMorning}
            disabled={scenarioLoading}
            className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:opacity-70 sm:flex"
          >
            {scenarioLoading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" fill="currentColor" aria-hidden="true" />
            )}
            Run demo
          </button>
        )}

        <div
          className={`flex flex-col items-end gap-0.5 rounded-lg border px-3 py-1.5 transition-colors sm:flex-row sm:items-center sm:gap-2 ${health.container}`}
          role="status"
          aria-live="polite"
        >
          <span className="sr-only">{health.srStatus}</span>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className={`size-2 rounded-full ${health.dot}`} />
            <span className="text-label-sm font-bold uppercase">{health.label}</span>
          </div>
          <span className="hidden text-label-sm font-medium uppercase opacity-80 lg:inline">
            {health.detail}
          </span>
        </div>
      </div>
      </div>

      {dispatch && (
        <p
          className={`text-label-sm font-medium ${
            dispatchChannels?.primary === "overlay_only"
              ? "text-muted-foreground"
              : "text-ok"
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
