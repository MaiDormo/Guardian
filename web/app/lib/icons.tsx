import {
  Sun,
  UtensilsCrossed,
  Pill,
  Moon,
  Heart,
  Mic,
  MapPin,
  Activity,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  woke_up: Sun,
  ate: UtensilsCrossed,
  took_meds: Pill,
  rested_well: Moon,
  helper_present: Heart,
  voice_checkin: Mic,
  location: MapPin,
  routine: Activity,
};

export function SignalIcon({ name, className, size = 24 }: { name: string; className?: string; size?: number }) {
  const Icon = ICON_MAP[name] || Activity;
  return <Icon size={size} className={className || "text-primary"} />;
}
