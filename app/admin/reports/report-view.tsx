"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { EXPENSE_META } from "@/lib/categories";
import type { AdminReport } from "@/types/database";
import { Button } from "@/components/ui/button";
import { BarList, DailyBars } from "@/components/admin/charts";
import { SectionTitle } from "@/components/ui/primitives";

const METRICS = [
  { id: "signups", label: "Sign-ups" },
  { id: "active", label: "Active users" },
  { id: "trips", label: "Trips created" },
  { id: "expenses", label: "Expenses logged" },
  { id: "documents", label: "Documents uploaded" },
  { id: "packing", label: "Packing items added" },
  { id: "events", label: "All events" },
] as const;
type Metric = (typeof METRICS)[number]["id"];

/** Weekly buckets for long ranges so bars stay readable. */
function bucket(daily: AdminReport["daily"], metric: Metric) {
  const pts = daily.map(d => ({ day: d.day, n: Number(d[metric]) }));
  if (pts.length <= 45) return pts;
  const out: { day: string; n: number }[] = [];
  for (let i = 0; i < pts.length; i += 7) out.push({ day: pts[i].day, n: pts.slice(i, i + 7).reduce((s, p) => s + p.n, 0) });
  return out;
}

export function ReportView({ report }: { report: AdminReport }) {
  const [metric, setMetric] = useState<Metric>("signups");
  const totals = useMemo(() => Object.fromEntries(METRICS.map(m => [m.id, report.daily.reduce((s, d) => s + Number(d[m.id]), 0)])) as Record<Metric, number>, [report]);
  const half = Math.floor(report.daily.length / 2);
  const trend = (m: Metric) => {
    const a = report.daily.slice(0, half).reduce((s, d) => s + Number(d[m]), 0);
    const b = report.daily.slice(half).reduce((s, d) => s + Number(d[m]), 0);
    return a === 0 ? (b > 0 ? 100 : 0) : Math.round(((b - a) / a) * 100);
  };

  function exportCsv() {
    const head = ["day", ...METRICS.map(m => m.id)];
    const lines = report.daily.map(d => [d.day, ...METRICS.map(m => d[m.id])].join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `travera-report-${report.days}d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const series = bucket(report.daily, metric);
  const weekly = report.daily.length > 45;

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-4 lg:grid-cols-7">
        {METRICS.map(m => {
          const tr = trend(m.id);
          return (
            <button key={m.id} onClick={() => setMetric(m.id)} aria-pressed={metric === m.id}
                    className={cn("bg-surface px-4 py-3.5 text-left transition-colors hover:bg-paper", metric === m.id && "bg-paper shadow-[inset_0_-2px_0_var(--color-accent)]")}>
              <p className="eyebrow">{m.label}</p>
              <p className="display mt-1.5 text-[24px] leading-none text-ink tabular">{formatNumber(totals[m.id])}</p>
              <p className={cn("mt-1 font-mono text-[11px]", tr > 0 ? "text-positive" : tr < 0 ? "text-negative" : "text-ink-3")}>
                {tr > 0 ? "▲" : tr < 0 ? "▼" : "•"} {Math.abs(tr)}% vs first half
              </p>
            </button>
          );
        })}
      </div>

      <section className="panel mt-6 px-5 py-5">
        <SectionTitle meta={weekly ? "per week" : "per day"} action={<Button size="sm" variant="secondary" onClick={exportCsv}><Download size={14} /> CSV</Button>}>
          {METRICS.find(m => m.id === metric)?.label}
        </SectionTitle>
        <DailyBars data={series} label={METRICS.find(m => m.id === metric)!.label} height={180} highlightLast={false} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="panel px-5 py-5">
          <SectionTitle>Expense categories</SectionTitle>
          <BarList items={report.expense_categories.map(c => ({ label: c.category[0].toUpperCase() + c.category.slice(1), n: c.n, color: EXPENSE_META[c.category]?.color }))} />
        </section>
        <section className="panel px-5 py-5">
          <SectionTitle>Document types</SectionTitle>
          <BarList items={report.document_types.map(d => ({ label: d.type[0].toUpperCase() + d.type.slice(1), n: d.n }))} />
        </section>
        <section className="panel px-5 py-5">
          <SectionTitle>Group size (all trips)</SectionTitle>
          <BarList items={report.group_sizes.map(g => ({ label: g.size >= 6 ? "6+ travelers" : `${g.size} ${g.size === 1 ? "traveler" : "travelers"}`, n: g.n }))} />
        </section>
      </div>

      <section className="mt-6">
        <SectionTitle meta={`${report.daily.length} days`}>Daily breakdown</SectionTitle>
        <div className="panel max-h-[420px] overflow-auto">
          <table className="w-full min-w-[680px] text-[12.5px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line text-left text-ink-3">
                <th className="px-4 py-2 font-medium">Day</th>
                {METRICS.map(m => <th key={m.id} className="px-3 py-2 text-right font-medium">{m.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono">
              {[...report.daily].reverse().map(d => (
                <tr key={d.day}>
                  <td className="px-4 py-1.5 font-sans text-ink-2">{formatDate(d.day)}</td>
                  {METRICS.map(m => <td key={m.id} className={cn("px-3 py-1.5 text-right tabular", Number(d[m.id]) ? "text-ink" : "text-ink-3/60")}>{d[m.id]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
