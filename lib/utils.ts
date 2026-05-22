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
    hotel:      "#2563eb",  // primary blue
    activity:   "#f59e0b",  // budget amber
    restaurant: "#e11d48",  // refined rose
    transit:    "#64748b",  // slate-500
    flight:     "#0ea5e9",  // sky/info
    free:       "#10b981",  // packing emerald
  };
  return map[type] ?? "#64748b";
}
