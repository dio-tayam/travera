"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BarChart3, LineChart, Table2, X } from "lucide-react";
import { EXPENSE_CATEGORIES, EXPENSE_META } from "@/lib/categories";
import { cn, formatCurrency, formatShortDate, parseDate, toISODate } from "@/lib/utils";

export type SpendItem = { date: string; amount: number; category: string };
export type DateRange = { start: string; end: string };

type Bucket = {
  key: string; start: string; end: string; days: number;
  totals: Record<string, number>; total: number; isToday: boolean; future: boolean; cum: number;
};

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return toISODate(d); };
const diffDays = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY);

/** Rounds up to 1/2/2.5/5 × 10ⁿ so gridlines land on readable numbers. */
function niceCeil(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Spending over time, stacked by expense category.
 * Daily: one bar per day (per week for long ranges) with a daily-budget line; tap a bar to filter.
 * Cumulative: running total vs the total budget and the planned pace.
 */
export function SpendingChart({ items, currency, tripStart, tripEnd, dailyBudget, totalBudget, selected, onSelect, compact, title, defaultMode = "daily" }: {
  items: SpendItem[]; currency: string; tripStart?: string | null; tripEnd?: string | null;
  dailyBudget?: number | null; totalBudget?: number | null;
  selected?: DateRange | null; onSelect?: (r: DateRange | null) => void; compact?: boolean; title?: string;
  defaultMode?: "daily" | "cumulative";
}) {
  const { t } = useTranslation("common");
  const [mode, setMode] = useState<"daily" | "cumulative">(defaultMode);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const today = toISODate(new Date());
  const money = (v: number) => formatCurrency(v, currency, { compact: true });

  const { buckets, weekly, cats } = useMemo(() => {
    const dated = items.filter(i => /^\d{4}-\d{2}-\d{2}$/.test(i.date) && Number(i.amount) > 0);
    const dates = dated.map(i => i.date).sort();
    if (!dates.length && !(tripStart && tripEnd)) return { buckets: [] as Bucket[], weekly: false, cats: [] as string[] };
    let from = [tripStart, dates[0]].filter(Boolean).sort()[0]!;
    let to = [tripEnd, dates[dates.length - 1]].filter(Boolean).sort().reverse()[0]!;
    if (diffDays(from, to) > 365) from = addDays(to, -365);
    if (diffDays(from, to) < 0) to = from;
    const span = diffDays(from, to) + 1;
    const weekly = span > 35;
    const size = weekly ? 7 : 1;
    const out: Bucket[] = [];
    for (let s = from; s <= to; s = addDays(s, size)) {
      const e = [addDays(s, size - 1), to].sort()[0];
      out.push({ key: s, start: s, end: e, days: diffDays(s, e) + 1, totals: {}, total: 0, isToday: s <= today && today <= e, future: s > today, cum: 0 });
    }
    for (const i of dated) {
      const b = out.find(x => x.start <= i.date && i.date <= x.end);
      if (!b) continue;
      const amt = Number(i.amount);
      b.totals[i.category] = (b.totals[i.category] ?? 0) + amt;
      b.total += amt;
    }
    let run = 0;
    for (const b of out) { run += b.total; b.cum = run; }
    const cats = EXPENSE_CATEGORIES.filter(c => out.some(b => b.totals[c]));
    return { buckets: out, weekly, cats: cats as string[] };
  }, [items, tripStart, tripEnd, today]);

  const bucketBudget = (b: Bucket) => (dailyBudget ? dailyBudget * b.days : null);
  const grand = buckets.reduce((s, b) => s + b.total, 0);
  // Average over days that have happened (pre-booked future costs would inflate it).
  const past = buckets.filter(b => !b.future);
  const elapsed = past.reduce((s, b) => s + b.days, 0) || 1;
  const pastTotal = past.length ? past.reduce((s, b) => s + b.total, 0) : grand;
  const peak = buckets.reduce<Bucket | null>((p, b) => (!p || b.total > p.total ? b : p), null);
  const overCount = dailyBudget ? buckets.filter(b => b.total > (bucketBudget(b) ?? Infinity) + 0.005).length : 0;

  // Daily scale
  const dailyMax = niceCeil(Math.max(...buckets.map(b => b.total), ...(dailyBudget ? buckets.map(b => (bucketBudget(b) ?? 0) * 1.05) : [0]), 1) * 1.08);
  // Cumulative scale + pace
  const tripDays = tripStart && tripEnd ? diffDays(tripStart, tripEnd) + 1 : null;
  const paceAt = (b: Bucket) => totalBudget && tripStart && tripDays
    ? Math.min(totalBudget, Math.max(0, totalBudget * ((diffDays(tripStart, b.end) + 1) / tripDays))) : null;
  const cumMax = niceCeil(Math.max(grand, totalBudget ?? 0, 1) * 1.08);
  const max = mode === "daily" ? dailyMax : cumMax;
  const ticks = [max, max / 2, 0];

  const labelFor = (b: Bucket) => (weekly ? t("chart.weekOf", { date: formatShortDate(b.start) }) : formatShortDate(b.start));
  const step = Math.max(1, Math.ceil(buckets.length / (compact ? 4 : 7)));
  // Ends + today always; regular ticks only where they won't collide with those.
  const todayIdx = buckets.findIndex(b => b.isToday);
  const clear = (i: number, j: number) => j < 0 || Math.abs(i - j) >= Math.ceil(step * 0.75);
  const showX = (i: number) => {
    const last = buckets.length - 1;
    if (i === 0 || i === last || i === todayIdx) return true;
    return i % step === 0 && clear(i, 0) && clear(i, last) && clear(i, todayIdx);
  };
  const isSel = (b: Bucket) => !!selected && selected.start === b.start && selected.end === b.end;
  const anySel = !!selected;
  const h = compact ? 120 : 176;

  function pickFromPointer(clientX: number) {
    const el = plotRef.current;
    if (!el || !buckets.length) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width - 1);
    setHover(Math.floor((x / r.width) * buckets.length));
  }

  if (!buckets.length) {
    return (
      <div>
        <p className="eyebrow">{title ?? t("budget.dailySpending")}</p>
        <p className="mt-3 text-[13px] text-ink-3">{t("budget.dailyEmpty")}</p>
      </div>
    );
  }

  const hb = hover != null ? buckets[hover] : null;

  return (
    <div className="min-w-0">
      {/* Header: title + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{title ?? t("budget.dailySpending")}</p>
        <div className="flex items-center gap-1">
          <div role="radiogroup" aria-label={t("chart.view")} className="flex rounded-full bg-sunken p-0.5">
            {([["daily", BarChart3], ["cumulative", LineChart]] as const).map(([m, Icon]) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); setHover(null); }}
                      className={cn("flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium transition-colors",
                                    mode === m ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-3 hover:text-ink")}>
                <Icon size={11} aria-hidden="true" /> {t(`chart.${m}`)}
              </button>
            ))}
          </div>
          <button onClick={() => setTable(v => !v)} aria-pressed={table} title={t("chart.table")} aria-label={t("chart.table")}
                  className={cn("grid h-7 w-7 place-items-center rounded-full transition-colors", table ? "bg-ink text-paper" : "text-ink-3 hover:bg-sunken hover:text-ink")}>
            <Table2 size={13} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <dl className="mt-3 grid grid-cols-3 gap-3 text-[11.5px]">
        <div><dt className="text-ink-3">{t("chart.avgDay")}</dt><dd className="mt-0.5 font-medium text-ink tabular">{money(pastTotal / elapsed)}</dd></div>
        <div className="min-w-0"><dt className="text-ink-3">{weekly ? t("chart.peakWeek") : t("chart.peakDay")}</dt>
          <dd className="mt-0.5 truncate font-medium text-ink tabular">{peak && peak.total > 0 ? `${money(peak.total)} · ${formatShortDate(peak.start)}` : "—"}</dd></div>
        <div><dt className="text-ink-3">{t("chart.overDays")}</dt>
          <dd className={cn("mt-0.5 flex items-center gap-1 font-medium tabular", overCount ? "text-negative" : "text-ink")}>
            {dailyBudget ? <>{overCount > 0 && <AlertTriangle size={11} aria-hidden="true" />}{overCount}</> : "—"}
          </dd></div>
      </dl>

      {table ? (
        <div className="mt-3 max-h-[220px] overflow-auto rounded-[10px] border border-line">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-surface text-ink-3">
              <tr><th className="px-2 py-1.5 text-start font-medium">{weekly ? t("chart.week") : t("budget.date")}</th>
                {cats.map(c => <th key={c} className="px-2 py-1.5 text-end font-medium">{t(`budget.categories.${c}`)}</th>)}
                <th className="px-2 py-1.5 text-end font-medium">{t("chart.total")}</th></tr>
            </thead>
            <tbody className="divide-y divide-line font-mono tabular">
              {buckets.filter(b => b.total > 0).map(b => (
                <tr key={b.key}><td className="px-2 py-1 font-sans text-ink-2">{labelFor(b)}</td>
                  {cats.map(c => <td key={c} className="px-2 py-1 text-end text-ink-2">{b.totals[c] ? money(b.totals[c]) : "·"}</td>)}
                  <td className="px-2 py-1 text-end text-ink">{money(b.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {/* Y axis */}
          <div className="relative w-9 shrink-0 font-mono text-[9.5px] text-ink-3" style={{ height: h }} aria-hidden="true">
            {ticks.map((v, i) => (
              <span key={i} className="absolute end-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${(1 - v / max) * 100}%` }}>
                {v === 0 ? "0" : formatCurrency(v, currency, { compact: true }).replace(/\.00$/, "")}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <div ref={plotRef} className="relative" style={{ height: h }}
                 onPointerMove={mode === "cumulative" ? e => pickFromPointer(e.clientX) : undefined}
                 onPointerLeave={() => setHover(null)}>
              {/* Gridlines */}
              {ticks.map((v, i) => (
                <span key={i} aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 border-t", v === 0 ? "border-line-strong" : "border-dashed border-line")}
                      style={{ top: `${(1 - v / max) * 100}%` }} />
              ))}

              {mode === "daily" ? (
                <>
                  {dailyBudget && !weekly && dailyBudget <= max && (
                    <span className="pointer-events-none absolute inset-x-0 z-[2] border-t-[1.5px] border-dashed border-ink/50" style={{ bottom: `${(dailyBudget / max) * 100}%` }}>
                      <span className="absolute -top-[15px] end-0 rounded bg-surface/90 px-1 font-mono text-[9.5px] text-ink-2">{t("chart.budgetPerDay", { amount: money(dailyBudget) })}</span>
                    </span>
                  )}
                  <div className={cn("absolute inset-0 flex items-end", buckets.length > 24 ? "gap-[2px]" : "gap-[4px]")}>
                    {buckets.map((b, i) => {
                      const over = !!bucketBudget(b) && b.total > bucketBudget(b)! + 0.005;
                      const dim = anySel && !isSel(b);
                      return (
                        <button key={b.key} type="button"
                                onClick={() => onSelect?.(isSel(b) ? null : { start: b.start, end: b.end })}
                                onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                                aria-pressed={onSelect ? isSel(b) : undefined}
                                aria-label={`${labelFor(b)}: ${formatCurrency(b.total, currency)}${over ? ` — ${t("chart.overBudget")}` : ""}`}
                                className={cn("group relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-[5px] outline-none transition-opacity",
                                              "focus-visible:bg-sunken/70", hover === i && "bg-sunken/60", dim && "opacity-35", !onSelect && "cursor-default")}>
                          {b.total > 0 ? (
                            <span className={cn("relative flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-[filter]",
                                                "group-hover:brightness-110", isSel(b) && "ring-2 ring-ink ring-offset-1 ring-offset-surface")}
                                  style={{ height: `${Math.max(3, (b.total / max) * 100)}%` }}>
                              {cats.filter(c => b.totals[c]).map(c => (
                                <span key={c} className="w-full" style={{ flexGrow: b.totals[c], flexBasis: 0, minHeight: 2, background: EXPENSE_META[c]?.color }} />
                              ))}
                            </span>
                          ) : (
                            <span className={cn("h-[3px] w-full rounded-full", b.future ? "bg-line" : "bg-line-strong/70")} />
                          )}
                          {over && (
                            <AlertTriangle size={10} aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 text-negative"
                                           style={{ bottom: `calc(${(b.total / max) * 100}% + 3px)` }} />
                          )}
                          {b.isToday && <span aria-hidden="true" className="absolute -bottom-[7px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <CumulativePlot buckets={buckets} max={max} pace={buckets.map(paceAt)} totalBudget={totalBudget ?? null} hover={hover} />
              )}

              {/* Tooltip — values lead, labels follow */}
              {hb && (
                <div role="status" className="pointer-events-none absolute top-0 z-10 w-[188px] rounded-[10px] border border-line bg-surface px-3 py-2.5 shadow-[0_14px_34px_-14px_rgb(22_24_29/0.45)]"
                     style={{ left: `clamp(0px, calc(${((hover! + 0.5) / buckets.length) * 100}% - 94px), calc(100% - 188px))` }}>
                  <p className="text-[11px] text-ink-3">{labelFor(hb)}{hb.isToday && ` · ${t("chart.today")}`}</p>
                  <p className="text-[15px] font-semibold text-ink tabular">
                    {formatCurrency(mode === "daily" ? hb.total : hb.cum, currency)}
                    {mode === "cumulative" && <span className="ms-1 text-[11px] font-normal text-ink-3">{t("chart.spentToDate")}</span>}
                  </p>
                  {mode === "daily" ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {cats.filter(c => hb.totals[c]).map(c => (
                        <li key={c} className="flex items-center gap-2 text-[11.5px]">
                          <span className="h-[2px] w-2.5 shrink-0 rounded-full" style={{ background: EXPENSE_META[c]?.color }} aria-hidden="true" />
                          <span className="flex-1 truncate text-ink-2">{t(`budget.categories.${c}`)}</span>
                          <span className="font-medium text-ink tabular">{money(hb.totals[c])}</span>
                        </li>
                      ))}
                    </ul>
                  ) : paceAt(hb) != null && (
                    <p className={cn("mt-1 text-[11.5px]", hb.cum > paceAt(hb)! ? "text-negative" : "text-positive")}>
                      {hb.cum > paceAt(hb)! ? t("chart.aheadOfPace", { amount: money(hb.cum - paceAt(hb)!) }) : t("chart.underPace", { amount: money(paceAt(hb)! - hb.cum) })}
                    </p>
                  )}
                  {mode === "daily" && bucketBudget(hb) != null && hb.total > 0 && (
                    <p className={cn("mt-1.5 flex items-center gap-1 border-t border-line pt-1.5 text-[11px]", hb.total > bucketBudget(hb)! ? "text-negative" : "text-ink-3")}>
                      {hb.total > bucketBudget(hb)! && <AlertTriangle size={10} aria-hidden="true" />}
                      {hb.total > bucketBudget(hb)!
                        ? t("chart.overBy", { amount: money(hb.total - bucketBudget(hb)!) })
                        : t("chart.underBy", { amount: money(bucketBudget(hb)! - hb.total) })}
                    </p>
                  )}
                  {mode === "daily" && onSelect && hb.total > 0 && <p className="mt-1 text-[10.5px] text-ink-3">{t("chart.tapToFilter")}</p>}
                </div>
              )}
            </div>

            {/* X axis */}
            <div className="relative mt-2 h-3.5 font-mono text-[9.5px] text-ink-3" aria-hidden="true">
              {buckets.map((b, i) => showX(i) && (
                <span key={b.key} className={cn("absolute -translate-x-1/2 whitespace-nowrap", b.isToday && "font-semibold text-accent-ink",
                                                i === 0 && "translate-x-0", i === buckets.length - 1 && "-translate-x-full")}
                      style={{ left: `${((i + (i === 0 ? 0 : i === buckets.length - 1 ? 1 : 0.5)) / buckets.length) * 100}%` }}>
                  {b.isToday ? t("chart.today") : formatShortDate(b.start)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend (always present for ≥ 2 series) + active filter */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {mode === "daily" ? cats.map(c => (
          <span key={c} className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: EXPENSE_META[c]?.color }} aria-hidden="true" />
            {t(`budget.categories.${c}`)}
          </span>
        )) : (
          <>
            <span className="flex items-center gap-1.5 text-[11px] text-ink-2"><span className="h-[2px] w-3 rounded-full bg-accent" aria-hidden="true" /> {t("chart.spentToDate")}</span>
            {totalBudget ? <span className="flex items-center gap-1.5 text-[11px] text-ink-2"><span className="w-3 border-t-[1.5px] border-dashed border-ink-3" aria-hidden="true" /> {t("chart.plannedPace")}</span> : null}
          </>
        )}
        {selected && onSelect && (
          <button onClick={() => onSelect(null)} className="ms-auto flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-[11px] text-paper">
            {selected.start === selected.end ? formatShortDate(selected.start) : `${formatShortDate(selected.start)} – ${formatShortDate(selected.end)}`} <X size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function CumulativePlot({ buckets, max, pace, totalBudget, hover }: {
  buckets: Bucket[]; max: number; pace: (number | null)[]; totalBudget: number | null; hover: number | null;
}) {
  const { t } = useTranslation("common");
  const n = buckets.length;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / max) * 100;
  let upTo = -1;
  buckets.forEach((b, i) => { if (!b.future) upTo = i; });
  const pts = buckets.slice(0, Math.max(upTo, 0) + 1).map((b, i) => `${x(i)},${y(b.cum)}`);
  const pacePts = pace.map((p, i) => (p == null ? null : `${x(i)},${y(p)}`)).filter(Boolean) as string[];
  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        {pts.length > 1 && <polygon points={`${x(0)},100 ${pts.join(" ")} ${pts.at(-1)!.split(",")[0]},100`} fill="var(--color-accent)" opacity="0.08" />}
        {pacePts.length > 1 && <polyline points={pacePts.join(" ")} fill="none" stroke="var(--color-ink-3)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1="0" y2="100" stroke="var(--color-ink)" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {totalBudget != null && totalBudget <= max && (
        <span className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-ink/50" style={{ top: `${y(totalBudget)}%` }}>
          <span className="absolute -top-[15px] end-0 rounded bg-surface/90 px-1 font-mono text-[9.5px] text-ink-2">{t("chart.budget")}</span>
        </span>
      )}
      {hover != null && hover <= upTo && (
        <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
              style={{ left: `${x(hover)}%`, top: `${y(buckets[hover].cum)}%` }} aria-hidden="true" />
      )}
      {upTo >= 0 && (
        <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
              style={{ left: `${x(upTo)}%`, top: `${y(buckets[upTo].cum)}%` }} aria-hidden="true" />
      )}
    </>
  );
}
