import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STOP_META } from "./categories";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Locale-aware formatting ──────────────────────────────────────────────
 * The active locale follows the UI language (set by I18nProvider on the client).
 * Server renders and the first client render always use English, so markup matches. */
let activeLocale = "en-PH";
export function setActiveLocale(locale: string) { activeLocale = locale; }
export function getActiveLocale() { return activeLocale; }

const fmtCache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function dtf(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `d|${activeLocale}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) { f = new Intl.DateTimeFormat(activeLocale, opts); fmtCache.set(key, f); }
  return f;
}

export function formatCurrency(amount: number, currency = "PHP", opts?: { compact?: boolean }): string {
  const value = Number(amount) || 0;
  const key = `n|${activeLocale}|${currency}|${opts?.compact ? 1 : 0}`;
  let f = fmtCache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    try {
      f = new Intl.NumberFormat(activeLocale, {
        style: "currency", currency,
        minimumFractionDigits: opts?.compact ? 0 : 2,
        maximumFractionDigits: opts?.compact ? 0 : 2,
      });
    } catch {
      f = new Intl.NumberFormat(activeLocale, { maximumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f.format(value);
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(activeLocale, opts).format(n);
}

/** Parse a `YYYY-MM-DD` date as a local date (avoids the UTC off-by-one). */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(date);
}

export function formatDate(date: string | Date): string {
  return dtf({ year: "numeric", month: "short", day: "numeric" }).format(parseDate(date));
}

export function formatShortDate(date: string | Date): string {
  return dtf({ month: "short", day: "numeric" }).format(parseDate(date));
}

export function formatWeekday(date: string | Date, style: "short" | "long" = "short"): string {
  return dtf({ weekday: style }).format(parseDate(date));
}

/** "Saturday, November 8" */
export function formatLongDate(date: string | Date, opts?: { month?: "long" | "short" }): string {
  return dtf({ weekday: "long", month: opts?.month ?? "long", day: "numeric" }).format(parseDate(date));
}

export function formatDateTime(date: string | Date): string {
  return dtf({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  try {
    return dtf({ month: "short", day: "numeric", year: "numeric" }).formatRange(s, e);
  } catch {
    const fmt = dtf({ month: "short", day: "numeric" });
    return `${fmt.format(s)} – ${fmt.format(e)}, ${e.getFullYear()}`;
  }
}

/** "Nov 20–27", "Nov 28 – Dec 3" — no year, for tight spaces. */
export function formatCompactRange(start: string, end?: string | null): string {
  const s = parseDate(start);
  if (!end) return formatShortDate(s);
  try {
    return dtf({ month: "short", day: "numeric" }).formatRange(s, parseDate(end));
  } catch {
    return `${formatShortDate(s)} – ${formatShortDate(parseDate(end))}`;
  }
}

/** "3 minutes ago", "yesterday" */
export function formatRelative(date: string | Date): string {
  const diff = (new Date(date).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(activeLocale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(new Date(date));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${formatNumber(bytes / 1024 ** i, { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
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

/** `YYYY-MM-DD` for a local date. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function generateShareToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}

export function getStopTypeColor(type: string): string {
  return STOP_META[type]?.color ?? "#6b7280";
}

/** Splits `total` into cents across weights; remainders go to the first entries so the sum is exact. */
export function splitByWeights(total: number, weights: number[]): number[] {
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map(w => (cents * w) / sum);
  const floored = raw.map(Math.floor);
  let rest = cents - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; floored[i] += 1; rest -= 1; }
  return floored.map(c => c / 100);
}
