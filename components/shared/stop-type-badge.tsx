import { cn } from "@/lib/utils";
import { getStopTypeColor } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  hotel: "Hotel",
  activity: "Activity",
  restaurant: "Restaurant",
  transit: "Transit",
  flight: "Flight",
  free: "Free Time",
};

export function StopTypeBadge({ type, className }: { type: string; className?: string }) {
  const color = getStopTypeColor(type);
  return (
    <span
      className={cn("text-xs px-2 py-0.5 rounded-full font-medium", className)}
      style={{ backgroundColor: `${color}18`, color }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}
