/** Caregiver-facing labels for backend similarity scores. Thresholds match PRD §5.2 / ReasoningPanel. */

import type { SignalState } from "./types";

export type PatternMatchLevel = "usual" | "drifting" | "unusual";

const DENSITY_SCORE_RE = /density score\s+([\d.]+)/i;
const COSINE_DISTANCE_RE = /cosine distance\s+([\d.]+)/i;
const CLARITY_SCORE_RE = /clarity(?:\s+score)?\s+([\d.]+)/i;
const SPEECH_RATE_RE = /speech\s+[\d.]+\s*wpm/i;

export function parseDensityScore(reason: string): number | null {
  const m = reason.match(DENSITY_SCORE_RE);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isNaN(n) ? null : n;
}

export function parseClarityScore(reason: string): number | null {
  const m = reason.match(CLARITY_SCORE_RE);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isNaN(n) ? null : n;
}

export function isTechnicalReason(reason: string): boolean {
  if (!reason) return false;
  return (
    DENSITY_SCORE_RE.test(reason) ||
    COSINE_DISTANCE_RE.test(reason) ||
    SPEECH_RATE_RE.test(reason) ||
    isDispenserReason(reason) ||
    isHelperPresenceReason(reason) ||
    isKitchenDwellReason(reason) ||
    isBreathingReason(reason)
  );
}

const DISPENSER_OPENED_RE = /dispenser opened\s*(?:—|-)?\s*compartment\s+(\w+)/i;
const DISPENSER_MISSED_RE = /dispenser missed\s*(?:—|-)?\s*(\d+)\s*min/i;

const KITCHEN_DWELL_RE = /kitchen dwell(?:\s+only)?\s+(\d+)\s*min/i;
const BREATHING_RATE_RE = /breathing rate\s+([\d.]+)\s*bpm/i;

export function isKitchenDwellReason(reason: string): boolean {
  return /kitchen dwell/i.test(reason);
}

export function isBreathingReason(reason: string): boolean {
  return /breathing rate|breathing normal|in-bed/i.test(reason);
}

export function isDispenserReason(reason: string): boolean {
  return /dispenser (opened|missed)/i.test(reason);
}

export function isHelperPresenceReason(reason: string): boolean {
  return /second presence|multi.presence|helper window/i.test(reason);
}

function capitalizeWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function patternMatchLevel(cosine: number): PatternMatchLevel {
  if (cosine >= 0.25) return "unusual";
  if (cosine >= 0.12) return "drifting";
  return "usual";
}

const PATTERN_LABELS: Record<PatternMatchLevel, string> = {
  usual: "Matches usual pattern",
  drifting: "Slightly off usual",
  unusual: "Well off usual",
};

const PATTERN_CONSOLE_LABELS: Record<PatternMatchLevel, string> = {
  usual: "usual",
  drifting: "drifting",
  unusual: "unusual",
};

export function formatPatternMatch(cosine: number | null | undefined): string | null {
  if (cosine == null || Number.isNaN(cosine)) return null;
  return PATTERN_LABELS[patternMatchLevel(cosine)];
}

export function formatPatternMatchConsole(cosine: number | null | undefined): string | null {
  if (cosine == null || Number.isNaN(cosine)) return null;
  return PATTERN_CONSOLE_LABELS[patternMatchLevel(cosine)];
}

export function formatRouteFamiliarityPercent(
  density: number | null | undefined
): string | null {
  if (density == null || Number.isNaN(density)) return null;
  return `${Math.round(density * 100)}%`;
}

export function formatRouteFamiliarityLabel(
  density: number | null | undefined
): string | null {
  const pct = formatRouteFamiliarityPercent(density);
  return pct ? `${pct} familiar with usual route` : null;
}

export function formatDistanceFromHome(meters: number | null | undefined): string {
  if (meters == null) return "—";
  if (meters === 0) return "At home";
  return `${meters}m from home`;
}

export function formatUsualArea(match: boolean | undefined | null): string {
  if (match == null) return "—";
  return match ? "Usual area" : "Unfamiliar area";
}

export function formatBaselineComparison(days: number | null | undefined): string | null {
  if (days == null) return null;
  return `Compared to last ${days} days`;
}

export function humanizeFeature(feature: string): string {
  return feature.replace(/_/g, " ");
}

export function humanizeFeatures(features: string[]): string {
  return features.map(humanizeFeature).join(", ");
}

export function formatLocationHeadline(state: SignalState, reason: string): string {
  if (state === "red") return "Wandering";
  if (state === "amber") return "Away";
  const density = parseDensityScore(reason);
  return formatRouteFamiliarityPercent(density) ?? "Usual route";
}

export function formatLocationSubtitle(state: SignalState, reason: string): string {
  if (state === "red") {
    if (reason.includes("footprint") || reason.includes("Outside")) {
      return reason.length > 40 ? reason.slice(0, 40) + "…" : reason;
    }
    return "Outside usual route";
  }
  if (state === "amber") return "Slightly off usual route";
  const density = parseDensityScore(reason);
  return formatRouteFamiliarityLabel(density) ?? "Following usual routine";
}

export function formatRoutineHeadline(state: SignalState): string {
  if (state === "red") return "Off track";
  if (state === "amber") return "Drifting";
  return "On track";
}

export function formatVoiceHeadline(state: SignalState): string {
  if (state === "red") return "Distress";
  if (state === "amber") return "Unclear";
  return "Clear";
}

const WOKE_UP_TIME_RE = /(\d{1,2}):(\d{2})/;
const WOKE_UP_HOUR_ONLY_RE = /(\d{1,2}):xx/i;

export function formatWokeUpTime(reason: string): string | null {
  const full = reason.match(WOKE_UP_TIME_RE);
  if (full) {
    const hour = parseInt(full[1], 10);
    const minute = full[2];
    const ampm = hour < 12 ? "AM" : "PM";
    return `${hour.toString().padStart(2, "0")}:${minute} ${ampm}`;
  }

  const hourOnly = reason.match(WOKE_UP_HOUR_ONLY_RE);
  if (hourOnly) {
    const hour = parseInt(hourOnly[1], 10);
    const h12 = hour % 12 || 12;
    const ampm = hour < 12 ? "AM" : "PM";
    return `${h12} ${ampm}`;
  }

  return null;
}

export function formatWokeUpSubtitle(reason: string): string {
  if (/bedroom motion/i.test(reason)) return "Morning bedroom activity";
  return reason.length > 40 ? reason.slice(0, 40) + "…" : reason;
}

export function formatTookMedsHeadline(state: SignalState, reason: string): string {
  if (state === "red") return "Missed";
  if (state === "amber") return "Late";
  const opened = reason.match(DISPENSER_OPENED_RE);
  if (opened) return `${capitalizeWord(opened[1])} dose`;
  if (/dispenser opened/i.test(reason)) return "Taken";
  return "Morning 3/3";
}

export function formatTookMedsSubtitle(state: SignalState, reason: string): string {
  if (state === "red") {
    const missed = reason.match(DISPENSER_MISSED_RE);
    if (missed) return `${missed[1]} min overdue`;
    return "Dispenser not opened";
  }
  if (state === "amber") return "Not yet taken today";
  const opened = reason.match(DISPENSER_OPENED_RE);
  if (opened) return `${capitalizeWord(opened[1])} compartment · on schedule`;
  if (/dispenser opened/i.test(reason)) return "On schedule";
  return "";
}

export function formatHelperPresentHeadline(state: SignalState, reason: string): string {
  if (state === "red") return "Alone";
  if (state === "amber") return "Uncertain";
  if (isHelperPresenceReason(reason)) return "Present";
  return "Present";
}

export function formatHelperPresentSubtitle(state: SignalState, reason: string): string {
  if (state === "red") return "No helper during expected window";
  if (state === "amber") return "Helper not confirmed yet";
  const timeWindow = reason.match(/(\d{1,2}:\d{2}[\u2013-]\d{1,2}:\d{2})/);
  if (timeWindow) return `Helper here ${timeWindow[1]}`;
  if (/second presence.*helper window/i.test(reason)) return "Helper here during usual window";
  if (/second presence/i.test(reason)) return "Second person detected";
  return "";
}

export function formatAteHeadline(state: SignalState, reason: string): string {
  if (state === "red") return "Skipped";
  if (state === "amber") return "Light meal";
  if (/lunch/i.test(reason)) return "Lunch";
  if (/dinner/i.test(reason)) return "Dinner";
  if (/breakfast/i.test(reason)) return "Breakfast";
  const dwell = reason.match(KITCHEN_DWELL_RE);
  if (dwell) return `${dwell[1]} min`;
  return "Breakfast";
}

export function formatAteSubtitle(state: SignalState, reason: string): string {
  if (!reason) return "";
  const dwell = reason.match(KITCHEN_DWELL_RE);
  if (dwell) {
    if (state === "amber") return `Only ${dwell[1]} min in kitchen`;
    return `${dwell[1]} min in kitchen`;
  }
  if (/lunch/i.test(reason)) return "Lunch detected in kitchen";
  if (/dinner/i.test(reason)) return "Dinner detected in kitchen";
  if (/breakfast/i.test(reason)) return "Breakfast detected in kitchen";
  if (state === "red") return "No meal activity detected";
  if (state === "amber") return "Minimal kitchen activity";
  return "Usual meal window";
}

export function formatRestedWellHeadline(state: SignalState, reason: string): string {
  const sleep = reason.match(/([\d.]+)\s*h(?:ours?)?/i);
  if (sleep) return `${sleep[1]}h`;
  const bpm = reason.match(BREATHING_RATE_RE);
  if (bpm) return `${bpm[1]} bpm`;
  if (state === "red") return "Poor";
  if (state === "amber") return "Restless";
  return "Good";
}

export function formatRestedWellSubtitle(state: SignalState, reason: string): string {
  if (!reason) return "";
  if (BREATHING_RATE_RE.test(reason)) {
    if (state === "green") return "Normal breathing rate";
    if (state === "amber") return "Breathing off baseline";
    return "Breathing outside normal band";
  }
  if (/in-bed/i.test(reason)) return "Sleep within usual hours";
  if (state === "red") return "Poor rest last night";
  if (state === "amber") return "Rest slightly off usual";
  return "Rested within usual range";
}

export function formatVoiceSubtitle(state: SignalState, reason: string): string | null {
  const clarity = parseClarityScore(reason);
  if (clarity != null) {
    const pct = Math.round(clarity * 100);
    if (state === "green") return `${pct}% voice clarity · sounds like her usual self`;
    return `${pct}% voice clarity`;
  }
  if (state === "green") return "Sounds like her usual self";
  if (state === "amber") return "Voice clarity dropping";
  if (state === "red") return "Confusion markers detected";
  return null;
}

/** Input shape for demo-console stat lines (matches ReasoningPayload fields used). */
export interface ReasoningStatInput {
  signal: string;
  cosine_distance: number | null;
  baseline_window_days: number | null;
  rationale: string;
}

const BASELINE_DEVIATION_RE =
  /Baseline deviation:\s*([\d.]+)(?:\s*[—–-]\s*([^.\n]+))?/i;
const CONFIDENCE_RE = /Confidence:\s*([\d.]+)/i;
const POSTURE_RE = /posture:\s*(\w+)/i;
const STATIONARY_RE = /stationary\s+(\d+)s/i;
const TIME_WINDOW_RE = /(\d{1,2}:\d{2}[\u2013–-]\d{1,2}:\d{2})/;
const OPTIMAL_TIME_RE = /(\d{1,2}:\d{2})\s+is\s+the\s+optimal/i;
const KITCHEN_DWELL_DELTA_RE = /Kitchen dwell[^.]*\(([+-−]?\d+)%\)/i;

function formatDeviationStat(cosine: number): string {
  const pct = Math.round(cosine * 100);
  if (cosine >= 0.25) return `${pct}% off baseline — intervention`;
  if (cosine >= 0.12) return `${pct}% off baseline — monitoring`;
  return `${pct}% off baseline — within range`;
}

/**
 * One bold scannable line for the demo Reasoning Console (no XML context block).
 */
export function formatReasoningStatLine(entry: ReasoningStatInput): string {
  const { signal, cosine_distance, baseline_window_days, rationale } = entry;

  const baselineMatch = rationale.match(BASELINE_DEVIATION_RE);
  if (baselineMatch) {
    const value = baselineMatch[1];
    const suffix = baselineMatch[2]?.trim();
    return suffix
      ? `Baseline deviation: ${value} — ${suffix}`
      : `Baseline deviation: ${value}`;
  }

  if (signal === "fall_detected") {
    const confidence = rationale.match(CONFIDENCE_RE);
    const posture = rationale.match(POSTURE_RE);
    const stationary = rationale.match(STATIONARY_RE);
    const parts: string[] = [];
    if (confidence) {
      const pct = Math.round(parseFloat(confidence[1]) * 100);
      parts.push(`Confidence: ${pct}%`);
    }
    if (posture) parts.push(posture[1]);
    if (stationary) parts.push(`${stationary[1]}s stationary`);
    if (parts.length > 0) return parts.join(" · ");
  }

  if (signal === "connection_window") {
    const window = rationale.match(TIME_WINDOW_RE);
    if (window) return `Best window: ${window[1]}`;
    const optimal = rationale.match(OPTIMAL_TIME_RE);
    if (optimal) return `Best window: ${optimal[1]}–16:00`;
    return "Best window: 15:00–16:00";
  }

  if (signal === "voice_checkin") {
    const clarity = parseClarityScore(rationale);
    if (clarity != null) return `${Math.round(clarity * 100)}% voice clarity`;
  }

  if (signal === "location") {
    const density = parseDensityScore(rationale);
    if (density != null) {
      return `${formatRouteFamiliarityPercent(density)} route familiarity`;
    }
  }

  if (signal === "ate") {
    const dwellDelta = rationale.match(KITCHEN_DWELL_DELTA_RE);
    if (dwellDelta) {
      const sign = dwellDelta[1].replace("−", "-");
      return `Kitchen dwell ${sign}% vs baseline`;
    }
  }

  if (signal === "took_meds") {
    const overdue = rationale.match(/(\d+)\s*min overdue/i);
    if (overdue) return `${overdue[1]} min overdue`;
  }

  if (signal === "routine" && typeof cosine_distance === "number") {
    return formatDeviationStat(cosine_distance);
  }

  const pattern = formatPatternMatch(cosine_distance);
  const baseline = formatBaselineComparison(baseline_window_days);
  if (pattern && baseline) return `${pattern} · ${baseline}`;
  if (pattern) return pattern;
  if (baseline) return baseline;

  return "Monitoring";
}
