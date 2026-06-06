import type { SignalName, SignalStateData } from "./types";

export function getSignalValue(name: SignalName, data: SignalStateData): string {
  if (data.state === "unknown") return "—";

  const r = data.reason || "";

  switch (name) {
    case "woke_up": {
      const m = r.match(/(\d{1,2}:\d{2})/);
      return m ? m[1] + " AM" : "Awake";
    }
    case "ate": {
      if (r.includes("lunch")) return "Lunch";
      if (r.includes("dinner")) return "Dinner";
      if (data.state === "red" || data.state === "amber") return "Minimal";
      return "Breakfast";
    }
    case "took_meds":
      return data.state === "red" ? "Missed" : data.state === "amber" ? "Late" : "Morning 3/3";
    case "rested_well": {
      const m = r.match(/([\d.]+)\s*h/);
      return m ? m[1] + "h" : (data.state === "red" ? "Poor" : "Good");
    }
    case "helper_present":
      return data.state === "red" ? "None" : "Present";
    case "voice_checkin":
      return data.state === "red" ? "Distress" : data.state === "amber" ? "Unclear" : "Clear";
    case "location":
      return data.state === "red" ? "Wandering" : data.state === "amber" ? "Away" : "Home area";
    case "routine":
      return data.state === "red" ? "Off track" : data.state === "amber" ? "Drifting" : "On track";
    default:
      return r.slice(0, 25) || "—";
  }
}

export function getSignalSubtitle(name: SignalName, data: SignalStateData): string {
  if (!data.cosine_distance && data.state === "unknown") return "";
  if (data.cosine_distance !== null) return `d=${data.cosine_distance.toFixed(2)}`;
  return "";
}
