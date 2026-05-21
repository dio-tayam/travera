import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
  const year = e.getFullYear();
  return `${fmt.format(s)} – ${fmt.format(e)}, ${year}`;
}

export function generateShareToken(): string {
  return Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10);
}

export function getStopTypeColor(type: string): string {
  const map: Record<string, string> = {
    hotel: "#0038a8",
    activity: "#fcd116",
    restaurant: "#ce1126",
    transit: "#9ca3af",
    flight: "#7dd3fc",
    free: "#86efac",
  };
  return map[type] ?? "#9ca3af";
}
