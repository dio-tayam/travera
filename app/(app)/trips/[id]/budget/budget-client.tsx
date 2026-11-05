"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { toast } from "sonner";
import {
  ArrowRight, Check, CheckCircle2, Download, Pencil, Plus, Receipt, Search, Trash2, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatCurrency, formatShortDate, parseDate } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_META } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Avatar, EmptyState, PageBody, PageHeader, Progress, SectionTitle } from "@/components/ui/primitives";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Split = Database["public"]["Tables"]["expense_splits"]["Row"];
type Member = {
  user_id: string; role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

/**
 * Net balances from *unsettled* splits only: each split means `user_id` owes `share_amount` to the payer.
 * Positive = others owe you; negative = you owe.
 */
function computeBalances(expenses: Expense[], splits: Split[]) {
  const payerOf = new Map(expenses.map(e => [e.id, e.paid_by]));
  const bal: Record<string, number> = {};
  for (const s of splits) {
    const payer = payerOf.get(s.expense_id);
    if (!payer || s.is_settled || s.user_id === payer) continue;
    const amt = Number(s.share_amount);
    bal[payer] = (bal[payer] ?? 0) + amt;
    bal[s.user_id] = (bal[s.user_id] ?? 0) - amt;
  }
  return bal;
}

/** Greedy minimal-transfer settlement plan. */
function computeSettlements(bal: Record<string, number>) {
  const debtors = Object.entries(bal).filter(([, b]) => b < -0.01).map(([id, b]) => ({ id, b: -b })).sort((a, b) => b.b - a.b);
  const creditors = Object.entries(bal).filter(([, b]) => b > 0.01).map(([id, b]) => ({ id, b })).sort((a, b) => b.b - a.b);
  const out: { from: string; to: string; amount: number }[] = [];
  for (const d of debtors) {
    for (const c of creditors) {
      if (d.b < 0.01) break;
      if (c.b < 0.01) continue;
      const amt = Math.min(d.b, c.b);
      out.push({ from: d.id, to: c.id, amount: Math.round(amt * 100) / 100 });
      d.b -= amt; c.b -= amt;
    }
  }
  return out;
}

interface Props {
  trip: Trip; members: Member[];
  initialExpenses: Expense[]; initialSplits: Split[];
  userId: string; canEdit: boolean;
}

export function BudgetClient({ trip, members, initialExpenses, initialSplits, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [splits, setSplits] = useState(initialSplits);
  const [editor, setEditor] = useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [settling, setSettling] = useState<string | null>(null);

  async function refresh() {
    const { data: exp } = await supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: false });
    if (!exp) return;
    setExpenses(exp);
    if (exp.length === 0) { setSplits([]); return; }
    const { data: sp } = await supabase.from("expense_splits").select("*").in("expense_id", exp.map(e => e.id));
    if (sp) setSplits(sp);
  }

  useEffect(() => {
    const ch = supabase.channel(`expenses:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${trip.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = trip.currency;
  const member = (uid: string) => members.find(m => m.user_id === uid)?.profiles;
  const nameOf = (uid: string) => uid === userId ? "You" : member(uid)?.display_name?.split(" ")[0] ?? "Traveler";

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const budget = trip.total_budget ?? 0;
  const remaining = budget - totalSpent;
  const spentPct = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const myShare = splits.filter(s => s.user_id === userId).reduce((s, sp) => s + Number(sp.share_amount), 0);

  const balances = useMemo(() => computeBalances(expenses, splits), [expenses, splits]);
  const settlements = useMemo(() => computeSettlements({ ...balances }), [balances]);
  const settledCount = splits.filter(s => s.is_settled).length;

  const people = useMemo(() => members.map(m => {
    const paid = expenses.filter(e => e.paid_by === m.user_id).reduce((s, e) => s + Number(e.amount), 0);
    const share = splits.filter(s => s.user_id === m.user_id).reduce((s, sp) => s + Number(sp.share_amount), 0);
    return { id: m.user_id, paid, share, balance: balances[m.user_id] ?? 0 };
  }), [members, expenses, splits, balances]);

  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => { totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const byDay = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(e => { totals[e.date] = (totals[e.date] ?? 0) + Number(e.amount); });
    return Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [expenses]);
  const dayMax = Math.max(1, ...byDay.map(([, v]) => v));
  const dailyBudget = budget > 0 && trip.start_date && trip.end_date
    ? budget / Math.max(1, Math.round((parseDate(trip.end_date).getTime() - parseDate(trip.start_date).getTime()) / 86_400_000) + 1)
    : null;

  const visible = expenses.filter(e =>
    (!catFilter || e.category === catFilter) &&
    (payerFilter === "all" || e.paid_by === payerFilter) &&
    (!query.trim() || (e.description ?? t(`budget.categories.${e.category}`)).toLowerCase().includes(query.trim().toLowerCase()))
  );

  async function removeExpense(id: string) {
    const prev = { expenses, splits };
    setExpenses(p => p.filter(e => e.id !== id));
    setSplits(p => p.filter(s => s.expense_id !== id));
    await supabase.from("expense_splits").delete().eq("expense_id", id);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { setExpenses(prev.expenses); setSplits(prev.splits); toast.error("Couldn't remove the expense"); return; }
    toast.success("Expense removed");
  }

  /** Marks every open split where `from` owes `to` as settled. */
  async function settle(from: string, to: string) {
    const ids = splits.filter(s => !s.is_settled && s.user_id === from &&
      expenses.find(e => e.id === s.expense_id)?.paid_by === to).map(s => s.id);
    if (!ids.length) return;
    setSettling(`${from}>${to}`);
    const { error } = await supabase.from("expense_splits").update({ is_settled: true }).in("id", ids);
    setSettling(null);
    if (error) { toast.error("Couldn't record the payment"); return; }
    setSplits(p => p.map(s => ids.includes(s.id) ? { ...s, is_settled: true } : s));
    toast.success(`${nameOf(from)} → ${nameOf(to)} marked as paid`);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [["Date", "Description", "Category", "Paid by", "Amount", "Currency", "Split between"]];
    expenses.forEach(e => rows.push([
      e.date, e.description ?? "", e.category, member(e.paid_by)?.display_name ?? "Traveler",
      String(e.amount), e.currency,
      splits.filter(s => s.expense_id === e.id).map(s => member(s.user_id)?.display_name ?? "Traveler").join("; "),
    ]));
    const blob = new Blob([rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.title.replace(/[^\w-]+/g, "_")}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow={t("nav.budget")}
        title={t("budget.expenses")}
        actions={<>
          {expenses.length > 0 && (
            <Button variant="secondary" onClick={exportCsv}><Download size={15} aria-hidden="true" /> Export CSV</Button>
          )}
          {canEdit && (
            <Button onClick={() => setEditor({ open: true, expense: null })}><Plus size={16} aria-hidden="true" /> {t("budget.addExpense")}</Button>
          )}
        </>}
      />

      {budget > 0 && remaining < 0 && (
        <p role="status" className="mt-6 rounded-[var(--radius-panel)] border border-negative/30 bg-negative-soft px-4 py-3 text-[13px] text-negative">
          You&apos;re <b className="font-semibold">{formatCurrency(-remaining, cur, { compact: true })}</b> over budget.
        </p>
      )}

      {/* Summary */}
      <div className="panel mt-6 overflow-hidden">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="eyebrow">{t("budget.totalSpent")}</p>
            <p className="display mt-2 text-[44px] text-ink tabular sm:text-[52px]">{formatCurrency(totalSpent, cur)}</p>
            {budget > 0 ? (
              <>
                <p className="mt-1 text-[13px] text-ink-2">
                  of {formatCurrency(budget, cur, { compact: true })} budget · {Math.round(spentPct)}% used
                  {dailyBudget && <span className="text-ink-3"> · {formatCurrency(dailyBudget, cur, { compact: true })}/day planned</span>}
                </p>
                <Progress value={spentPct} className="mt-4 h-2" label="Budget used"
                          tone={spentPct > 100 ? "negative" : spentPct > 85 ? "accent" : "ink"} />
              </>
            ) : (
              <p className="mt-1 text-[13px] text-ink-3">No budget set for this trip.</p>
            )}
            <dl className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <dt className="eyebrow">{t("budget.remaining")}</dt>
                <dd className={cn("mt-1.5 text-[15px] font-medium tabular", remaining < 0 ? "text-negative" : "text-ink")}>
                  {budget > 0 ? formatCurrency(remaining, cur, { compact: true }) : "—"}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">{t("budget.yourShare")}</dt>
                <dd className="mt-1.5 text-[15px] font-medium text-ink tabular">{formatCurrency(myShare, cur, { compact: true })}</dd>
              </div>
              <div>
                <dt className="eyebrow">Your balance</dt>
                <dd className={cn("mt-1.5 text-[15px] font-medium tabular",
                                  (balances[userId] ?? 0) > 0.01 ? "text-positive" : (balances[userId] ?? 0) < -0.01 ? "text-negative" : "text-ink")}>
                  {(balances[userId] ?? 0) > 0.01 ? "+" : ""}{formatCurrency(balances[userId] ?? 0, cur, { compact: true })}
                </dd>
              </div>
            </dl>
          </div>

          {/* Daily spending */}
          <div className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="eyebrow">Daily spending</p>
            {byDay.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-3">Spending per day will show here.</p>
            ) : (
              <div className="relative mt-4 flex h-[120px] items-end gap-1.5" role="img"
                   aria-label={`Daily spending over ${byDay.length} days`}>
                {dailyBudget && dailyBudget < dayMax * 1.05 && (
                  <span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60"
                        style={{ bottom: `${(dailyBudget / dayMax) * 100}%` }}>
                    <span className="absolute -top-4 right-0 font-mono text-[9.5px] text-accent-ink">daily budget</span>
                  </span>
                )}
                {byDay.map(([date, v]) => (
                  <div key={date} className="group relative flex h-full flex-1 flex-col justify-end">
                    <div className={cn("w-full rounded-t-[4px] transition-colors", dailyBudget && v > dailyBudget ? "bg-accent" : "bg-ink/80 group-hover:bg-ink")}
                         style={{ height: `${Math.max(4, (v / dayMax) * 100)}%` }} />
                    <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 font-mono text-[10px] text-paper group-hover:block">
                      {formatCurrency(v, cur, { compact: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {byDay.length > 0 && (
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-3">
                <span>{formatShortDate(byDay[0][0])}</span>
                {byDay.length > 1 && <span>{formatShortDate(byDay[byDay.length - 1][0])}</span>}
              </div>
            )}
          </div>
        </div>

        {byCategory.length > 0 && (
          <div className="border-t border-line bg-paper/60 px-5 py-4 sm:px-6">
            <div className="flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              {byCategory.map(([cat, amt]) => (
                <span key={cat} style={{ width: `${(amt / totalSpent) * 100}%`, backgroundColor: EXPENSE_META[cat]?.color }}
                      className="h-full border-r-2 border-surface last:border-r-0" />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              {byCategory.map(([cat, amt]) => (
                <button key={cat} onClick={() => setCatFilter(c => c === cat ? null : cat)} aria-pressed={catFilter === cat}
                        className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                                      catFilter === cat ? "border-ink bg-ink text-paper" : "border-transparent text-ink-2 hover:bg-sunken")}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXPENSE_META[cat]?.color }} aria-hidden="true" />
                  {t(`budget.categories.${cat}`)}
                  <span className={cn("font-mono text-[11px]", catFilter === cat ? "text-paper/60" : "text-ink-3")}>
                    {Math.round((amt / totalSpent) * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Ledger */}
        <section aria-labelledby="ledger-heading">
          <SectionTitle meta={visible.length !== expenses.length ? `${visible.length} of ${expenses.length}` : expenses.length}>
            <span id="ledger-heading">All expenses</span>
          </SectionTitle>

          {expenses.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search expenses" className="h-9 pl-8" aria-label="Search expenses" />
              </div>
              <div className="sm:w-44">
                <Select value={payerFilter} onChange={e => setPayerFilter(e.target.value)} className="h-9" aria-label="Filter by payer">
                  <option value="all">Anyone paid</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>Paid by {nameOf(m.user_id)}</option>)}
                </Select>
              </div>
              {(catFilter || payerFilter !== "all" || query) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => { setCatFilter(null); setPayerFilter("all"); setQuery(""); }}>
                  <X size={14} /> Clear
                </Button>
              )}
            </div>
          )}

          {expenses.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses yet"
                        description="Log what you spend and Travera will split it between travelers."
                        action={canEdit && <Button variant="secondary" onClick={() => setEditor({ open: true, expense: null })}><Plus size={15} /> {t("budget.addExpense")}</Button>} />
          ) : visible.length === 0 ? (
            <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">No expenses match these filters.</p>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {visible.map(exp => {
                const meta = EXPENSE_META[exp.category] ?? EXPENSE_META.other;
                const Icon = meta.icon;
                const expSplits = splits.filter(s => s.expense_id === exp.id);
                const allSettled = expSplits.length > 0 && expSplits.every(s => s.is_settled || s.user_id === exp.paid_by);
                return (
                  <li key={exp.id} className="group flex items-center gap-3.5 px-4 py-3 sm:px-5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                          style={{ backgroundColor: `${meta.color}14`, color: meta.color }}>
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <button className="min-w-0 flex-1 text-left disabled:cursor-default" disabled={!canEdit}
                            onClick={() => setEditor({ open: true, expense: exp })}>
                      <p className="truncate text-[14px] font-medium text-ink">{exp.description || t(`budget.categories.${exp.category}`)}</p>
                      <p className="truncate text-[12px] text-ink-3">
                        <span className="font-mono">{formatShortDate(exp.date)}</span> · {t("budget.paidBy")} {nameOf(exp.paid_by)}
                        {expSplits.length > 0 && ` · split ${expSplits.length} ${expSplits.length === 1 ? "way" : "ways"}`}
                        {allSettled && expSplits.length > 1 && <span className="text-positive"> · settled</span>}
                      </p>
                    </button>
                    <span className="shrink-0 text-[14px] font-medium text-ink tabular">{formatCurrency(exp.amount, exp.currency)}</span>
                    {canEdit && (
                      <div className="flex shrink-0 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <button onClick={() => setEditor({ open: true, expense: exp })} aria-label={`Edit ${exp.description ?? "expense"}`}
                                className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removeExpense(exp.id)} aria-label={`Delete ${exp.description ?? "expense"}`}
                                className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right column */}
        <aside className="space-y-8 lg:sticky lg:top-6">
          <section aria-labelledby="settle-heading">
            <SectionTitle meta={settledCount > 0 ? `${settledCount} paid` : undefined}><span id="settle-heading">{t("budget.settlements")}</span></SectionTitle>
            <div className="panel">
              {settlements.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-4">
                  <CheckCircle2 size={18} className="text-positive" aria-hidden="true" />
                  <p className="text-[13px] text-ink-2">{t("budget.allSettled")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {settlements.map(s => (
                    <li key={`${s.from}>${s.to}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex items-center -space-x-1.5">
                        <Avatar name={member(s.from)?.display_name} src={member(s.from)?.avatar_url} size={26} className="ring-2 ring-surface" />
                        <Avatar name={member(s.to)?.display_name} src={member(s.to)?.avatar_url} size={26} className="ring-2 ring-surface" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-ink-2">
                          <span className="font-medium text-ink">{nameOf(s.from)}</span>
                          <ArrowRight size={12} className="mx-1 inline -translate-y-px text-ink-3" aria-label="pays" />
                          <span className="font-medium text-ink">{nameOf(s.to)}</span>
                        </p>
                        <p className="text-[13px] font-semibold text-ink tabular">{formatCurrency(s.amount, cur)}</p>
                      </div>
                      {canEdit && (
                        <Button size="sm" variant="secondary" loading={settling === `${s.from}>${s.to}`}
                                onClick={() => settle(s.from, s.to)} aria-label={`Mark ${nameOf(s.from)} paid ${nameOf(s.to)}`}>
                          <Check size={13} /> Paid
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {members.length > 1 && (
            <section aria-labelledby="people-heading">
              <SectionTitle><span id="people-heading">{t("trip.travelers")}</span></SectionTitle>
              <ul className="panel divide-y divide-line">
                {people.map(p => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={member(p.id)?.display_name} src={member(p.id)?.avatar_url} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{nameOf(p.id)}</p>
                      <p className="text-[11.5px] text-ink-3">
                        Paid {formatCurrency(p.paid, cur, { compact: true })} · Share {formatCurrency(p.share, cur, { compact: true })}
                      </p>
                    </div>
                    <span className={cn("text-[13px] font-semibold tabular",
                                        p.balance > 0.01 ? "text-positive" : p.balance < -0.01 ? "text-negative" : "text-ink-3")}>
                      {p.balance > 0.01 ? "+" : ""}{formatCurrency(p.balance, cur, { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {editor.open && (
        <ExpenseDialog trip={trip} members={members} userId={userId} expense={editor.expense}
                       existingSplits={editor.expense ? splits.filter(s => s.expense_id === editor.expense!.id) : []}
                       nameOf={nameOf}
                       onClose={() => setEditor({ open: false, expense: null })}
                       onDelete={editor.expense ? () => { removeExpense(editor.expense!.id); setEditor({ open: false, expense: null }); } : undefined}
                       onSaved={refresh} />
      )}
    </PageBody>
  );
}

/* ── Add / edit expense ──────────────────────────────────────────────────── */
function ExpenseDialog({ trip, members, userId, expense, existingSplits, nameOf, onClose, onDelete, onSaved }: {
  trip: Trip; members: Member[]; userId: string; expense: Expense | null; existingSplits: Split[];
  nameOf: (uid: string) => string; onClose: () => void; onDelete?: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "",
    category: (expense?.category ?? "food") as Expense["category"],
    date: expense?.date ?? new Date().toISOString().split("T")[0],
    paid_by: expense?.paid_by ?? userId,
  });
  const [between, setBetween] = useState<string[]>(
    existingSplits.length ? existingSplits.map(s => s.user_id) : members.map(m => m.user_id)
  );
  const amount = parseFloat(form.amount) || 0;
  const each = between.length ? amount / between.length : 0;
  const toggle = (id: string) => setBetween(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!(amount > 0)) { setError("Enter an amount greater than zero."); return; }
    if (between.length === 0) { setError("Choose at least one person to split with."); return; }
    setLoading(true); setError(null);
    const supabase = createClient();
    const payload = {
      paid_by: form.paid_by, amount, currency: trip.currency, category: form.category,
      description: form.description.trim() || null, date: form.date,
    };
    let expenseId = expense?.id;
    if (expense) {
      const { error: err } = await supabase.from("expenses").update(payload).eq("id", expense.id);
      if (err) { setError(err.message); setLoading(false); return; }
      await supabase.from("expense_splits").delete().eq("expense_id", expense.id);
    } else {
      const { data, error: err } = await supabase.from("expenses").insert({ ...payload, trip_id: trip.id }).select().single();
      if (err || !data) { setError(err?.message ?? "Couldn't save"); setLoading(false); return; }
      expenseId = data.id;
    }
    // Split to the cent; the first person absorbs any rounding remainder.
    const base = Math.floor((amount / between.length) * 100) / 100;
    const remainder = Math.round((amount - base * between.length) * 100) / 100;
    const { error: splitErr } = await supabase.from("expense_splits").insert(between.map((uid, i) => ({
      expense_id: expenseId!, user_id: uid, share_amount: i === 0 ? base + remainder : base,
      // the payer's own share is never "owed", so mark it settled
      is_settled: uid === form.paid_by,
    })));
    setLoading(false);
    if (splitErr) { setError(splitErr.message); return; }
    toast.success(expense ? "Expense updated" : "Expense added");
    onSaved();
    onClose();
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }} title={expense ? "Edit expense" : t("budget.addExpense")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount" htmlFor="ex-amount">
            <Input id="ex-amount" type="number" inputMode="decimal" min="0" step="0.01" autoFocus required
                   value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                   placeholder="0.00" className="text-[15px]" />
          </Field>
          <Field label="Currency">
            <div className="flex h-10 items-center rounded-[var(--radius-control)] border border-line bg-paper px-3 font-mono text-[13px] text-ink-2">
              {trip.currency}
            </div>
          </Field>
        </div>

        <Field label="Description" htmlFor="ex-desc" optional>
          <Input id="ex-desc" value={form.description} placeholder="Dinner at Ichiran"
                 onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("packing.category")}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPENSE_CATEGORIES.map(c => {
              const { icon: Icon, color } = EXPENSE_META[c];
              const active = form.category === c;
              return (
                <button key={c} type="button" aria-pressed={active} onClick={() => setForm(f => ({ ...f, category: c }))}
                        className={cn("flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border text-[12.5px] transition-colors",
                                      active ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:bg-sunken")}>
                  <Icon size={14} style={active ? undefined : { color }} aria-hidden="true" />
                  <span className="truncate">{t(`budget.categories.${c}`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("budget.paidBy")} htmlFor="ex-paid">
            <Select id="ex-paid" value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}
            </Select>
          </Field>
          <Field label="Date" htmlFor="ex-date">
            <Input id="ex-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 flex w-full items-baseline justify-between text-[13px] font-medium text-ink">
            <span>Split between</span>
            {amount > 0 && between.length > 0 && (
              <span className="font-mono text-[12px] font-normal text-ink-3">{formatCurrency(each, trip.currency)} each</span>
            )}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const on = between.includes(m.user_id);
              return (
                <button key={m.user_id} type="button" aria-pressed={on} onClick={() => toggle(m.user_id)}
                        className={cn("flex h-9 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] transition-colors",
                                      on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:bg-sunken")}>
                  <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={24} />
                  {nameOf(m.user_id)}
                  {on && <Check size={13} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {members.length > 1 && (
            <div className="mt-2 flex gap-3 text-[12px]">
              <button type="button" className="text-ink-2 underline-offset-2 hover:underline" onClick={() => setBetween(members.map(m => m.user_id))}>Everyone</button>
              <button type="button" className="text-ink-2 underline-offset-2 hover:underline" onClick={() => setBetween([form.paid_by])}>Only the payer</button>
            </div>
          )}
        </fieldset>

        <ModalActions>
          {onDelete && (
            <Button type="button" variant="danger" className="sm:mr-auto" onClick={onDelete}><Trash2 size={14} /> Delete</Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" loading={loading}>{expense ? t("common.save") : t("budget.addExpense")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
