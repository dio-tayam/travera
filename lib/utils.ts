import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STOP_META } from "./categories";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "PHP", opts?: { compact?: boolean }): string {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    minimumFractionDigits: opts?.compact ? 0 : 2,
    maximumFractionDigits: opts?.compact ? 0 : 2,
  }).format(value);
}

/** Parse a `YYYY-MM-DD` date as a local date (avoids the UTC off-by-one). */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(date);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" })
    .format(parseDate(date));
}

export function formatShortDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parseDate(date));
}

export function formatWeekday(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parseDate(date));
}

export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const fmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
  return `${fmt.format(s)} – ${fmt.format(e)}, ${e.getFullYear()}`;
}

/** "Nov 20–27", "Nov 28 – Dec 3" — no year, for tight spaces. */
export function formatCompactRange(start: string, end?: string | null): string {
  const s = parseDate(start);
  if (!end) return formatShortDate(s);
  const e = parseDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return s.getDate() === e.getDate() ? formatShortDate(s) : `${formatShortDate(s)}–${e.getDate()}`;
  }
  return `${formatShortDate(s)} – ${formatShortDate(e)}`;
}

/** Inclusive number of days in a trip, or null when dates are missing. */
export function tripLength(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const diff = Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000);
  return diff >= 0 ? diff + 1 : null;
}

/** Whole days from today until `date` (negative when in the past). */
export function daysUntil(date: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(date).getTime() - today.getTime()) / 86_400_000);
}

export function isPastTrip(end?: string | null): boolean {
  return !!end && daysUntil(end) < 0;
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

export function getStopTypeColor(type: string): string {
  return STOP_META[type]?.color ?? "#6b7280";
}
