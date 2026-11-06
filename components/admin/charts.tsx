"use client";

import { cn, formatNumber, formatShortDate } from "@/lib/utils";

/** Compact daily bar chart in the app's ink/accent style. Hover a bar for its value. */
export function DailyBars({ data, label, height = 120, highlightLast = true }: {
  data: { day: string; n: number }[]; label: string; height?: number; highlightLast?: boolean;
}) {
  const max = Math.max(1, ...data.map(d => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <figure>
      <div className="relative flex items-end gap-[3px]" style={{ height }} role="img"
           aria-label={`${label}: ${total} over ${data.length} days`}>
        {data.map((d, i) => (
          <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
            <div className={cn("w-full rounded-t-[3px] transition-colors",
                               highlightLast && i === data.length - 1 ? "bg-accent" : "bg-ink/75 group-hover:bg-ink",
                               d.n === 0 && "bg-line")}
                 style={{ height: `${d.n === 0 ? 2 : Math.max(4, (d.n / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10px] text-paper group-hover:block">
              {formatShortDate(d.day)} · {formatNumber(d.n)}
            </span>
          </div>
        ))}
      </div>
      {data.length > 0 && (
        <figcaption className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3">
          <span>{formatShortDate(data[0].day)}</span>
          <span>{formatShortDate(data[data.length - 1].day)}</span>
        </figcaption>
      )}
    </figure>
  );
}

/** Horizontal labelled bars for breakdowns (destinations, categories…). */
export function BarList({ items, empty = "No data yet." }: { items: { label: string; n: number; color?: string }[]; empty?: string }) {
  const max = Math.max(1, ...items.map(i => i.n));
  if (!items.length) return <p className="text-[13px] text-ink-3">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map(i => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{i.label}</span>
            <span className="font-mono text-[12px] text-ink-2 tabular">{formatNumber(i.n)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full" style={{ width: `${(i.n / max) * 100}%`, background: i.color ?? "var(--color-ink)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "accent" | "negative" | "positive" }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("display mt-2 text-[30px] leading-none text-ink tabular",
                        tone === "accent" && "text-accent-ink", tone === "negative" && "text-negative", tone === "positive" && "text-positive")}>{value}</dd>
      {sub && <dd className="mt-1.5 text-[12px] text-ink-3">{sub}</dd>}
    </div>
  );
}
