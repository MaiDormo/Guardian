import type { SignalName, SignalStateData } from "./types";

function trimReason(r: string, max = 22): string {
  return r.length > max ? r.slice(0, max) + "…" : r;
}

export function getSignalValue(name: SignalName, data: SignalStateData): string {
  if (data.state === "unknown") return "—";

  const r = data.reason || "";

  switch (name) {
    case "woke_up": {
      const m = r.match(/(\d{1,2}:\d{2})/);
      if (m) return m[1] + " AM";
      if (r) return trimReason(r);
      return "Awake";
    }
    case "ate": {
      if (r.includes("lunch")) return "Lunch";
      if (r.includes("dinner")) return "Dinner";
      if (r.includes("breakfast")) return "Breakfast";
      if (data.state === "red" || data.state === "amber") return r ? trimReason(r) : "Minimal";
      if (r) return trimReason(r);
      return "Breakfast";
    }
    case "took_meds":
      if (data.state === "red") return r ? trimReason(r) : "Missed";
      if (data.state === "amber") return r ? trimReason(r) : "Late";
      if (r) return trimReason(r);
      return "Morning 3/3";
    case "rested_well": {
      const m = r.match(/([\d.]+)\s*h/);
      if (m) return m[1] + "h";
      if (r) return trimReason(r);
      return data.state === "red" ? "Poor" : "Good";
    }
    case "helper_present":
      if (data.state === "red") return r ? trimReason(r) : "None";
      if (r) return trimReason(r);
      return "Present";
    case "voice_checkin":
      if (data.state === "red") return r ? trimReason(r) : "Distress";
      if (data.state === "amber") return r ? trimReason(r) : "Unclear";
      if (r) return trimReason(r);
      return "Clear";
    case "location":
      if (data.state === "red") return r ? trimReason(r) : "Wandering";
      if (data.state === "amber") return r ? trimReason(r) : "Away";
      if (r) return trimReason(r);
      return "Home area";
    case "routine":
      if (data.state === "red") return r ? trimReason(r) : "Off track";
      if (data.state === "amber") return r ? trimReason(r) : "Drifting";
      if (r) return trimReason(r);
      return "On track";
    default:
      return r ? trimReason(r) : "—";
  }
}

export function getSignalSubtitle(name: SignalName, data: SignalStateData): string {
  if (data.state === "unknown") return "";
  if (data.cosine_distance != null) return `d=${data.cosine_distance.toFixed(2)}`;
  if (data.reason) return data.reason.slice(0, 40);
  return "";
}
