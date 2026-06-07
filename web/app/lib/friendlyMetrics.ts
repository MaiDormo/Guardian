/** Caregiver-facing labels for backend similarity scores. Thresholds match PRD §5.2 / ReasoningPanel. */

export type PatternMatchLevel = "usual" | "drifting" | "unusual";

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
