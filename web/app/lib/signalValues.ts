import type { SignalName, SignalStateData } from "./types";
import {
  formatAteHeadline,
  formatAteSubtitle,
  formatHelperPresentHeadline,
  formatHelperPresentSubtitle,
  formatLocationHeadline,
  formatLocationSubtitle,
  formatPatternMatch,
  formatRestedWellHeadline,
  formatRestedWellSubtitle,
  formatRoutineHeadline,
  formatTookMedsHeadline,
  formatTookMedsSubtitle,
  formatVoiceHeadline,
  formatVoiceSubtitle,
  formatWokeUpSubtitle,
  formatWokeUpTime,
} from "./friendlyMetrics";

export function getSignalValue(name: SignalName, data: SignalStateData): string {
  if (data.state === "unknown") return "—";

  const r = data.reason || "";

  switch (name) {
    case "woke_up": {
      const time = formatWokeUpTime(r);
      if (time) return time;
      return "Awake";
    }
    case "ate":
      return formatAteHeadline(data.state, r);
    case "took_meds":
      return formatTookMedsHeadline(data.state, r);
    case "rested_well":
      return formatRestedWellHeadline(data.state, r);
    case "helper_present":
      return formatHelperPresentHeadline(data.state, r);
    case "voice_checkin":
      return formatVoiceHeadline(data.state);
    case "location":
      return formatLocationHeadline(data.state, r);
    case "routine":
      return formatRoutineHeadline(data.state);
    default:
      return "—";
  }
}

export function getSignalSubtitle(name: SignalName, data: SignalStateData): string {
  if (data.state === "unknown") return "";

  const r = data.reason || "";

  switch (name) {
    case "location":
      return formatLocationSubtitle(data.state, r);
    case "routine": {
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
    case "voice_checkin": {
      const subtitle = formatVoiceSubtitle(data.state, r);
      return subtitle ?? "";
    }
    case "woke_up": {
      if (!r) return "";
      const pattern = formatPatternMatch(data.cosine_distance);
      if (pattern) return pattern;
      return formatWokeUpSubtitle(r);
    }
    case "ate": {
      const subtitle = formatAteSubtitle(data.state, r);
      if (subtitle) return subtitle;
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
    case "rested_well": {
      const subtitle = formatRestedWellSubtitle(data.state, r);
      if (subtitle) return subtitle;
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
    case "took_meds": {
      const subtitle = formatTookMedsSubtitle(data.state, r);
      if (subtitle) return subtitle;
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
    case "helper_present": {
      const subtitle = formatHelperPresentSubtitle(data.state, r);
      if (subtitle) return subtitle;
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
    default: {
      const pattern = formatPatternMatch(data.cosine_distance);
      return pattern ?? "";
    }
  }
}
