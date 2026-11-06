"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowRight, Check, CheckCircle2, Download, Lock, Pencil, Plus, Receipt, Search, Trash2, User, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { SpendingChart, type DateRange } from "@/components/trip/spending-chart";
import { cn, formatCurrency, formatShortDate, parseDate, splitByWeights, toISODate } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_META } from "@/lib/categories";
import type { Member } from "@/lib/types";
import type { ExpenseRow, ExpenseSplitRow, Scope, TripRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Avatar, EmptyState, PageBody, PageHeader, Progress, SectionTitle } from "@/components/ui/primitives";

type Expense = ExpenseRow;
type Split = ExpenseSplitRow;
type Tab = "group" | "mine";

/**
 * Net balances from *unsettled* group splits only: each split means `user_id` owes `share_amount` to the payer.
 * Positive = others owe you; negative = you owe.
 */
function computeBalances(expenses: Expense[], splits: Split[]) {
  const payerOf = new Map(expenses.filter(e => e.scope === "group").map(e => [e.id, e.paid_by]));
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

/**
 * Who pays whom: unsettled group debts netted per pair of travelers (A owes B 10, B owes A 4 → A pays B 6).
 * Every suggestion maps to real splits, so settle_debt() can mark exactly those as paid.
 */
function computeSettlements(expenses: Expense[], splits: Split[]) {
  const net = pairwiseNet(expenses, splits);
  return Object.entries(net)
    .map(([k, amount]) => { const [a, b] = k.split("|"); return amount > 0 ? { from: a, to: b, amount } : { from: b, to: a, amount: -amount }; })
    .map(s => ({ ...s, amount: Math.round(s.amount * 100) / 100 }))
    .filter(s => s.amount > 0.009)
    .sort((a, b) => b.amount - a.amount);
}

/** Keyed "a|b" (a < b): positive = a owes b, negative = b owes a. */
function pairwiseNet(expenses: Expense[], splits: Split[]) {
  const payerOf = new Map(expenses.filter(e => e.scope === "group").map(e => [e.id, e.paid_by]));
  const net: Record<string, number> = {};
  for (const s of splits) {
    const payer = payerOf.get(s.expense_id);
    if (!payer || s.is_settled || s.user_id === payer) continue;
    const [a, b] = s.user_id < payer ? [s.user_id, payer] : [payer, s.user_id];
    net[`${a}|${b}`] = (net[`${a}|${b}`] ?? 0) + (s.user_id === a ? 1 : -1) * Number(s.share_amount);
  }
  return net;
}

interface Props {
  trip: TripRow; members: Member[];
  initialExpenses: Expense[]; initialSplits: Split[];
  userId: string; canEdit: boolean; initialMyBudget: number | null;
}

export function BudgetClient({ trip, members, initialExpenses, initialSplits, userId, canEdit, initialMyBudget }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [splits, setSplits] = useState(initialSplits);
  const [tab, setTab] = useState<Tab>("group");
  const [editor, setEditor] = useState<{ open: boolean; expense: Expense | null; scope: Scope }>({ open: false, expense: null, scope: "group" });
  const [myBudget, setMyBudget] = useState<number | null>(initialMyBudget);

  // Refetch everything this page shows. Guarded so a slow, older response never overwrites a newer one.
  const seq = useRef(0);
  async function refresh() {
    const n = ++seq.current;
    const [{ data: exp, error }, { data: mb }] = await Promise.all([
      supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: false }),
      supabase.from("member_budgets").select("amount").eq("trip_id", trip.id).eq("user_id", userId).maybeSingle(),
    ]);
    if (error || !exp || n !== seq.current) return;
    const { data: sp } = exp.length
      ? await supabase.from("expense_splits").select("*").in("expense_id", exp.map((e: Expense) => e.id))
      : { data: [] };
    if (n !== seq.current) return;
    setExpenses(exp as Expense[]);
    if (sp) setSplits(sp as Split[]);
    setMyBudget((mb as { amount: number } | null)?.amount ?? null);
  }

  // Live: anyone's group expenses/splits, plus my own personal expenses & budget (RLS filters the rest).
  const live = useRealtime(`budget:${trip.id}`, [
    { table: "expenses", filter: `trip_id=eq.${trip.id}` },
    { table: "expense_splits" },
    { table: "member_budgets", filter: `trip_id=eq.${trip.id}` },
  ], refresh);

  /** Show a saved expense instantly, then confirm with a refetch. */
  function applySaved(exp: Expense, expSplits: Split[]) {
    setExpenses(p => [exp, ...p.filter(e => e.id !== exp.id)].sort((a, b) => b.date.localeCompare(a.date)));
    setSplits(p => [...p.filter(s => s.expense_id !== exp.id), ...expSplits]);
    refresh();
  }

  const member = (uid: string) => members.find(m => m.user_id === uid)?.profiles;
  const nameOf = (uid: string) => uid === userId ? t("common.you") : member(uid)?.display_name?.split(" ")[0] ?? t("common.traveler");

  const group = useMemo(() => expenses.filter(e => e.scope !== "personal"), [expenses]);
  const personal = useMemo(() => expenses.filter(e => e.scope === "personal" && e.created_by === userId), [expenses, userId]);

  async function removeExpense(id: string) {
    const prev = { expenses, splits };
    setExpenses(p => p.filter(e => e.id !== id));
    setSplits(p => p.filter(s => s.expense_id !== id));
    const { error } = await supabase.from("expenses").delete().eq("id", id); // splits cascade
    if (error) { setExpenses(prev.expenses); setSplits(prev.splits); toast.error(t("budget.removeFailed")); return; }
    toast.success(t("budget.removed"));
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows: string[][] = [];
    if (tab === "group") {
      rows.push([t("budget.csv.date"), t("budget.csv.description"), t("budget.csv.category"), t("budget.paidBy"),
                 t("budget.csv.amount"), t("budget.csv.currency"), t("budget.csv.splitBetween")]);
      group.forEach(e => rows.push([
        e.date, e.description ?? "", t(`budget.categories.${e.category}`), member(e.paid_by)?.display_name ?? t("common.traveler"),
        String(e.amount), e.currency,
        splits.filter(s => s.expense_id === e.id).map(s => `${member(s.user_id)?.display_name ?? t("common.traveler")} (${s.share_amount})`).join("; "),
      ]));
    } else {
      rows.push([t("budget.csv.date"), t("budget.csv.description"), t("budget.csv.category"), t("budget.csv.type"),
                 t("budget.csv.myCost"), t("budget.csv.currency")]);
      personal.forEach(e => rows.push([e.date, e.description ?? "", t(`budget.categories.${e.category}`), t("budget.personal"), String(e.amount), e.currency]));
      splits.filter(s => s.user_id === userId).forEach(s => {
        const e = group.find(x => x.id === s.expense_id);
        if (e) rows.push([e.date, e.description ?? "", t(`budget.categories.${e.category}`), t("budget.groupShare"), String(s.share_amount), e.currency]);
      });
    }
    const blob = new Blob(["﻿" + rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${trip.title.replace(/[^\w-]+/g, "_")}-${tab === "group" ? "group" : "my"}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const openNew = (scope: Scope) => setEditor({ open: true, expense: null, scope });
  const canAddHere = tab === "mine" || canEdit;
  const hasRows = tab === "group" ? group.length > 0 : personal.length > 0 || splits.some(s => s.user_id === userId);

  return (
    <PageBody>
      <PageHeader
        eyebrow={t("nav.budget")}
        title={t("budget.expenses")}
        actions={<>
          {hasRows && <Button variant="secondary" onClick={exportCsv}><Download size={15} aria-hidden="true" /> {t("budget.exportCsv")}</Button>}
          {canAddHere && (
            <Button onClick={() => openNew(tab === "mine" ? "personal" : "group")}>
              <Plus size={16} aria-hidden="true" /> {tab === "mine" ? t("budget.addPersonal") : t("budget.addExpense")}
            </Button>
          )}
        </>}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t("budget.view")} value={tab} onChange={setTab} options={[
          { id: "group", label: t("budget.tabs.group"), icon: Users, count: group.length },
          { id: "mine", label: t("budget.tabs.mine"), icon: User, count: personal.length },
        ]} />
        <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
          {tab === "group"
            ? <><Users size={13} aria-hidden="true" /> {canEdit ? t("budget.groupHint") : t("budget.groupHintViewer")}</>
            : <><Lock size={13} aria-hidden="true" /> {t("budget.mineHint")}</>}
          <LiveDot live={live} />
        </p>
      </div>

      {tab === "group" ? (
        <GroupView trip={trip} members={members} expenses={group} splits={splits} userId={userId} canEdit={canEdit}
                   nameOf={nameOf} member={member}
                   onEdit={e => setEditor({ open: true, expense: e, scope: "group" })} onAdd={() => openNew("group")}
                   onRemove={removeExpense} onSettled={refresh} />
      ) : (
        <MineView trip={trip} groupExpenses={group} personal={personal} splits={splits} userId={userId}
                  nameOf={nameOf} member={member} myBudget={myBudget} setMyBudget={setMyBudget}
                  onEdit={e => setEditor({ open: true, expense: e, scope: "personal" })} onAdd={() => openNew("personal")}
                  onRemove={removeExpense} onSettled={refresh} />
      )}

      {editor.open && (
        <ExpenseDialog trip={trip} members={members} userId={userId} expense={editor.expense} scope={editor.scope}
                       canEditGroup={canEdit}
                       existingSplits={editor.expense ? splits.filter(s => s.expense_id === editor.expense!.id) : []}
                       nameOf={nameOf}
                       onClose={() => setEditor(e => ({ ...e, open: false, expense: null }))}
                       onDelete={editor.expense ? () => { removeExpense(editor.expense!.id); setEditor(e => ({ ...e, open: false, expense: null })); } : undefined}
                       onSaved={applySaved} />
      )}
    </PageBody>
  );
}

type ProfileFn = (uid: string) => Member["profiles"] | undefined;

/* ── Group view ──────────────────────────────────────────────────────────── */
function GroupView({ trip, members, expenses, splits, userId, canEdit, nameOf, member, onEdit, onAdd, onRemove, onSettled }: {
  trip: TripRow; members: Member[]; expenses: Expense[]; splits: Split[]; userId: string; canEdit: boolean;
  nameOf: (uid: string) => string; member: ProfileFn;
  onEdit: (e: Expense) => void; onAdd: () => void; onRemove: (id: string) => void; onSettled: () => void;
}) {
  const { t } = useTranslation("common");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [payerFilter, setPayerFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const cur = trip.currency;

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const budget = trip.total_budget ?? 0;
  const remaining = budget - totalSpent;
  const spentPct = budget > 0 ? (totalSpent / budget) * 100 : 0;
  const groupIds = new Set(expenses.map(e => e.id));
  const groupSplits = splits.filter(s => groupIds.has(s.expense_id));
  const myShare = groupSplits.filter(s => s.user_id === userId).reduce((s, sp) => s + Number(sp.share_amount), 0);

  const balances = useMemo(() => computeBalances(expenses, groupSplits), [expenses, groupSplits]);
  const settlements = useMemo(() => computeSettlements(expenses, groupSplits), [expenses, groupSplits]);
  const settledCount = groupSplits.filter(s => s.is_settled && expenses.find(e => e.id === s.expense_id)?.paid_by !== s.user_id).length;

  const people = members.map(m => {
    const paid = expenses.filter(e => e.paid_by === m.user_id).reduce((s, e) => s + Number(e.amount), 0);
    const share = groupSplits.filter(s => s.user_id === m.user_id).reduce((s, sp) => s + Number(sp.share_amount), 0);
    return { id: m.user_id, paid, share, balance: balances[m.user_id] ?? 0 };
  });

  const dailyBudget = budget > 0 && trip.start_date && trip.end_date
    ? budget / Math.max(1, Math.round((parseDate(trip.end_date).getTime() - parseDate(trip.start_date).getTime()) / 86_400_000) + 1)
    : null;

  const visible = expenses.filter(e =>
    (!range || (e.date >= range.start && e.date <= range.end)) &&
    (!catFilter || e.category === catFilter) &&
    (payerFilter === "all" || e.paid_by === payerFilter) &&
    (!query.trim() || (e.description ?? t(`budget.categories.${e.category}`)).toLowerCase().includes(query.trim().toLowerCase()))
  );

  async function settle(from: string, to: string) {
    setSettling(`${from}>${to}`);
    const { error } = await createClient().rpc("settle_debt", { p_trip_id: trip.id, p_from: from, p_to: to });
    setSettling(null);
    if (error) { toast.error(t("budget.settleFailed")); return; }
    toast.success(t("budget.settledToast", { from: nameOf(from), to: nameOf(to) }));
    onSettled();
  }

  return (
    <>
      {budget > 0 && remaining < 0 && (
        <p role="status" className="mt-6 rounded-[var(--radius-panel)] border border-negative/30 bg-negative-soft px-4 py-3 text-[13px] text-negative">
          {t("budget.overBudget", { amount: formatCurrency(-remaining, cur, { compact: true }) })}
        </p>
      )}

      <div className="panel mt-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="eyebrow">{t("budget.groupSpent")}</p>
            <p className="display mt-2 text-[44px] text-ink tabular sm:text-[52px]">{formatCurrency(totalSpent, cur)}</p>
            {budget > 0 ? (
              <>
                <p className="mt-1 text-[13px] text-ink-2">
                  {t("budget.ofBudgetUsed", { budget: formatCurrency(budget, cur, { compact: true }), pct: Math.round(spentPct) })}
                  {dailyBudget && <span className="text-ink-3"> · {t("budget.perDayPlanned", { amount: formatCurrency(dailyBudget, cur, { compact: true }) })}</span>}
                </p>
                <Progress value={spentPct} className="mt-4 h-2" label={t("budget.budgetUsed")}
                          tone={spentPct > 100 ? "negative" : spentPct > 85 ? "accent" : "ink"} />
              </>
            ) : (
              <p className="mt-1 text-[13px] text-ink-3">{t("budget.noBudget")}</p>
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
                <dt className="eyebrow">{t("budget.yourBalance")}</dt>
                <dd className={cn("mt-1.5 text-[15px] font-medium tabular",
                                  (balances[userId] ?? 0) > 0.01 ? "text-positive" : (balances[userId] ?? 0) < -0.01 ? "text-negative" : "text-ink")}>
                  {(balances[userId] ?? 0) > 0.01 ? "+" : ""}{formatCurrency(balances[userId] ?? 0, cur, { compact: true })}
                </dd>
              </div>
            </dl>
          </div>
          <div className="border-t border-line pt-5 lg:border-s lg:border-t-0 lg:ps-6 lg:pt-0">
            <SpendingChart items={expenses.map(e => ({ date: e.date, amount: Number(e.amount), category: e.category }))} currency={cur}
                           tripStart={trip.start_date} tripEnd={trip.end_date} dailyBudget={dailyBudget} totalBudget={budget || null}
                           selected={range} onSelect={r => { setRange(r); if (r) document.getElementById("ledger-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          </div>
        </div>
        <CategoryBar items={expenses.map(e => ({ category: e.category, amount: Number(e.amount) }))} active={catFilter} onToggle={setCatFilter} />
      </div>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="ledger-heading" className="min-w-0">
          <SectionTitle meta={visible.length !== expenses.length ? t("common.xOfY", { x: visible.length, y: expenses.length }) : expenses.length}>
            <span id="ledger-heading">{t("budget.groupExpenses")}</span>
          </SectionTitle>

          {expenses.length > 0 && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("budget.search")} className="h-9 ps-8" aria-label={t("budget.search")} />
              </div>
              <div className="sm:w-44">
                <Select value={payerFilter} onChange={e => setPayerFilter(e.target.value)} className="h-9" aria-label={t("budget.filterPayer")}>
                  <option value="all">{t("budget.anyonePaid")}</option>
                  {members.map(m => <option key={m.user_id} value={m.user_id}>{t("budget.paidByName", { name: nameOf(m.user_id) })}</option>)}
                </Select>
              </div>
              {(catFilter || payerFilter !== "all" || query || range) && (
                <Button variant="ghost" size="sm" className="h-9" onClick={() => { setCatFilter(null); setPayerFilter("all"); setQuery(""); setRange(null); }}>
                  <X size={14} /> {t("common.clear")}
                </Button>
              )}
            </div>
          )}

          {expenses.length === 0 ? (
            <EmptyState icon={Receipt} title={t("budget.emptyGroup")}
                        description={canEdit ? t("budget.emptyGroupDesc") : t("budget.emptyGroupViewer")}
                        action={canEdit && <Button variant="secondary" onClick={onAdd}><Plus size={15} /> {t("budget.addExpense")}</Button>} />
          ) : visible.length === 0 ? (
            <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">{t("budget.noMatch")}</p>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {visible.map(exp => {
                const expSplits = splits.filter(s => s.expense_id === exp.id);
                const others = expSplits.filter(s => s.user_id !== exp.paid_by);
                const allSettled = others.length > 0 && others.every(s => s.is_settled);
                const mine = expSplits.find(s => s.user_id === userId);
                return (
                  <ExpenseRowItem key={exp.id} exp={exp} canEdit={canEdit} onEdit={onEdit} onRemove={onRemove}
                    meta={<>
                      <span className="font-mono">{formatShortDate(exp.date)}</span> · {t("budget.paidBy")} {nameOf(exp.paid_by)}
                      {expSplits.length > 0 && ` · ${t("budget.splitWays", { count: expSplits.length })}`}
                      {allSettled && <span className="text-positive"> · {t("budget.settled")}</span>}
                    </>}
                    aside={mine && <span className="block text-end text-[11px] text-ink-3">{t("budget.yoursAmount", { amount: formatCurrency(mine.share_amount, cur) })}</span>} />
                );
              })}
            </ul>
          )}
        </section>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6">
          <section aria-labelledby="settle-heading">
            <SectionTitle meta={settledCount > 0 ? t("budget.paidCount", { count: settledCount }) : undefined}><span id="settle-heading">{t("budget.settlements")}</span></SectionTitle>
            <div className="panel">
              {settlements.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-4">
                  <CheckCircle2 size={18} className="text-positive" aria-hidden="true" />
                  <p className="text-[13px] text-ink-2">{t("budget.allSettled")}</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {settlements.map(s => {
                    const mayConfirm = canEdit || s.to === userId;
                    return (
                      <li key={`${s.from}>${s.to}`} className={cn("flex items-center gap-3 px-4 py-3", (s.from === userId || s.to === userId) && "bg-accent-soft/40")}>
                        <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                          <Avatar name={member(s.from)?.display_name} src={member(s.from)?.avatar_url} size={26} className="ring-2 ring-surface" />
                          <Avatar name={member(s.to)?.display_name} src={member(s.to)?.avatar_url} size={26} className="ring-2 ring-surface" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] text-ink-2">
                            <span className="font-medium text-ink">{nameOf(s.from)}</span>
                            <ArrowRight size={12} className="mx-1 inline -translate-y-px text-ink-3 rtl:-scale-x-100" aria-label={t("budget.pays")} />
                            <span className="font-medium text-ink">{nameOf(s.to)}</span>
                          </p>
                          <p className="text-[13px] font-semibold text-ink tabular">{formatCurrency(s.amount, cur)}</p>
                        </div>
                        {mayConfirm && (
                          <Button size="sm" variant="secondary" loading={settling === `${s.from}>${s.to}`}
                                  onClick={() => settle(s.from, s.to)} aria-label={t("budget.markPaidAria", { from: nameOf(s.from), to: nameOf(s.to) })}>
                            <Check size={13} /> {t("budget.paid")}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {settlements.length > 0 && !canEdit && (
                <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-3">{t("budget.settleHintViewer")}</p>
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
                        {t("budget.paidShare", { paid: formatCurrency(p.paid, cur, { compact: true }), share: formatCurrency(p.share, cur, { compact: true }) })}
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
    </>
  );
}

/* ── Mine view (private) ─────────────────────────────────────────────────── */
function MineView({ trip, groupExpenses, personal, splits, userId, nameOf, member, myBudget, setMyBudget, onEdit, onAdd, onRemove, onSettled }: {
  trip: TripRow; groupExpenses: Expense[]; personal: Expense[]; splits: Split[]; userId: string;
  nameOf: (uid: string) => string; member: ProfileFn; myBudget: number | null; setMyBudget: (n: number | null) => void;
  onEdit: (e: Expense) => void; onAdd: () => void; onRemove: (id: string) => void; onSettled: () => void;
}) {
  const { t } = useTranslation("common");
  const cur = trip.currency;
  const [editingBudget, setEditingBudget] = useState(false);
  const [draft, setDraft] = useState(myBudget != null ? String(myBudget) : "");
  const [settling, setSettling] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);

  const myShares = splits.filter(s => s.user_id === userId)
    .map(s => ({ split: s, exp: groupExpenses.find(e => e.id === s.expense_id) }))
    .filter((x): x is { split: Split; exp: Expense } => !!x.exp);
  const shareTotal = myShares.reduce((s, x) => s + Number(x.split.share_amount), 0);
  const personalTotal = personal.reduce((s, e) => s + Number(e.amount), 0);
  const myTotal = shareTotal + personalTotal;
  const pct = myBudget ? (myTotal / myBudget) * 100 : 0;

  // Net position with each traveler (group, unsettled): positive = they owe me, negative = I owe them.
  const withPerson: Record<string, number> = {};
  for (const [k, v] of Object.entries(pairwiseNet(groupExpenses, splits))) {
    const [a, b] = k.split("|");
    if (a === userId) withPerson[b] = -v;
    else if (b === userId) withPerson[a] = v;
  }
  const iOwe = Object.fromEntries(Object.entries(withPerson).filter(([, v]) => v < -0.009).map(([u, v]) => [u, -v]));
  const owedToMe = Object.fromEntries(Object.entries(withPerson).filter(([, v]) => v > 0.009));
  const oweTotal = Object.values(iOwe).reduce((a, b) => a + b, 0);
  const owedTotal = Object.values(owedToMe).reduce((a, b) => a + b, 0);

  async function saveBudget(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const value = draft.trim() ? Number(draft) : null;
    if (value != null && (!Number.isFinite(value) || value < 0)) { toast.error(t("budget.invalidAmount")); return; }
    const { error } = value == null
      ? await supabase.from("member_budgets").delete().eq("trip_id", trip.id).eq("user_id", userId)
      : await supabase.from("member_budgets").upsert({ trip_id: trip.id, user_id: userId, amount: value, updated_at: new Date().toISOString() }, { onConflict: "trip_id,user_id" });
    if (error) { toast.error(t("budget.budgetFailed")); return; }
    setMyBudget(value);
    setEditingBudget(false);
    toast.success(t("budget.budgetSaved"));
  }

  async function confirmReceived(from: string) {
    setSettling(from);
    const { error } = await createClient().rpc("settle_debt", { p_trip_id: trip.id, p_from: from, p_to: userId });
    setSettling(null);
    if (error) { toast.error(t("budget.settleFailed")); return; }
    toast.success(t("budget.settledToast", { from: nameOf(from), to: nameOf(userId) }));
    onSettled();
  }

  const allLedger = [
    ...personal.map(e => ({ kind: "personal" as const, exp: e, amount: Number(e.amount) })),
    ...myShares.map(x => ({ kind: "share" as const, exp: x.exp, amount: Number(x.split.share_amount), settled: x.split.is_settled })),
  ].sort((a, b) => b.exp.date.localeCompare(a.exp.date));
  const ledger = range ? allLedger.filter(l => l.exp.date >= range.start && l.exp.date <= range.end) : allLedger;

  return (
    <>
      <div className="panel mt-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Lock size={11} aria-hidden="true" /> {t("budget.myTripCost")}</p>
            <p className="display mt-2 text-[44px] text-ink tabular sm:text-[52px]">{formatCurrency(myTotal, cur)}</p>
            <p className="mt-1 text-[13px] text-ink-2">
              {t("budget.costBreakdown", { share: formatCurrency(shareTotal, cur, { compact: true }), personal: formatCurrency(personalTotal, cur, { compact: true }) })}
            </p>
            {editingBudget ? (
              <form onSubmit={saveBudget} className="mt-4 flex gap-2">
                <Input type="number" inputMode="decimal" min="0" step="0.01" value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                       placeholder={t("budget.myBudgetPlaceholder")} aria-label={t("budget.myBudget")} className="h-9 max-w-48" />
                <Button size="sm" type="submit" className="h-9">{t("common.save")}</Button>
                <Button size="sm" type="button" variant="ghost" className="h-9" onClick={() => setEditingBudget(false)}>{t("common.cancel")}</Button>
              </form>
            ) : myBudget ? (
              <>
                <div className="mt-4 flex items-center justify-between text-[12.5px] text-ink-2">
                  <span>{t("budget.ofMyBudget", { budget: formatCurrency(myBudget, cur, { compact: true }), pct: Math.round(pct) })}</span>
                  <button onClick={() => { setDraft(String(myBudget)); setEditingBudget(true); }} className="flex items-center gap-1 text-ink-3 hover:text-ink">
                    <Pencil size={12} /> {t("common.edit")}
                  </button>
                </div>
                <Progress value={pct} className="mt-2 h-2" label={t("budget.myBudget")} tone={pct > 100 ? "negative" : pct > 85 ? "accent" : "ink"} />
                {pct > 100 && <p className="mt-2 text-[12.5px] text-negative">{t("budget.overMyBudget", { amount: formatCurrency(myTotal - myBudget, cur, { compact: true }) })}</p>}
              </>
            ) : (
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => setEditingBudget(true)}>
                <Plus size={13} /> {t("budget.setMyBudget")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 self-start">
            <div className="rounded-[12px] border border-line px-4 py-3">
              <p className="eyebrow">{t("budget.youOwe")}</p>
              <p className={cn("mt-1.5 text-[20px] font-semibold tabular", oweTotal > 0.01 ? "text-negative" : "text-ink-3")}>{formatCurrency(oweTotal, cur, { compact: true })}</p>
            </div>
            <div className="rounded-[12px] border border-line px-4 py-3">
              <p className="eyebrow">{t("budget.owedToYou")}</p>
              <p className={cn("mt-1.5 text-[20px] font-semibold tabular", owedTotal > 0.01 ? "text-positive" : "text-ink-3")}>{formatCurrency(owedTotal, cur, { compact: true })}</p>
            </div>
            <div className="col-span-2 border-t border-line pt-4">
              <SpendingChart items={allLedger.map(l => ({ date: l.exp.date, amount: l.amount, category: l.exp.category }))} currency={cur} compact
                             title={t("chart.mySpending")} tripStart={trip.start_date} tripEnd={trip.end_date} totalBudget={myBudget}
                             selected={range} onSelect={setRange}
                             dailyBudget={myBudget && trip.start_date && trip.end_date
                               ? myBudget / Math.max(1, Math.round((parseDate(trip.end_date).getTime() - parseDate(trip.start_date).getTime()) / 86_400_000) + 1)
                               : null} />
            </div>
          </div>
        </div>
        <CategoryBar items={allLedger.map(l => ({ category: l.exp.category, amount: l.amount }))} />
      </div>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="mine-heading" className="min-w-0">
          <SectionTitle meta={range ? t("common.xOfY", { x: ledger.length, y: allLedger.length }) : ledger.length}
                        action={range && <Button variant="ghost" size="sm" onClick={() => setRange(null)}><X size={14} /> {t("common.clear")}</Button>}>
            <span id="mine-heading">{t("budget.mySpending")}</span>
          </SectionTitle>
          {ledger.length === 0 && range ? (
            <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">{t("budget.noMatch")}</p>
          ) : ledger.length === 0 ? (
            <EmptyState icon={Receipt} title={t("budget.emptyMine")} description={t("budget.emptyMineDesc")}
                        action={<Button variant="secondary" onClick={onAdd}><Plus size={15} /> {t("budget.addPersonal")}</Button>} />
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {ledger.map(l => l.kind === "personal" ? (
                <ExpenseRowItem key={`p-${l.exp.id}`} exp={l.exp} canEdit onEdit={onEdit} onRemove={onRemove}
                  meta={<><span className="font-mono">{formatShortDate(l.exp.date)}</span> · <Lock size={10} className="inline -translate-y-px" aria-hidden="true" /> {t("budget.personal")}</>} />
              ) : (
                <ExpenseRowItem key={`s-${l.exp.id}`} exp={l.exp} canEdit={false} amountOverride={l.amount}
                  meta={<>
                    <span className="font-mono">{formatShortDate(l.exp.date)}</span> · {t("budget.shareOf", { total: formatCurrency(l.exp.amount, cur, { compact: true }) })}
                    {" · "}{l.exp.paid_by === userId ? t("budget.youPaid") : t("budget.paidByName", { name: nameOf(l.exp.paid_by) })}
                    {"settled" in l && l.settled && l.exp.paid_by !== userId && <span className="text-positive"> · {t("budget.settled")}</span>}
                  </>} />
              ))}
            </ul>
          )}
        </section>

        <aside className="min-w-0 space-y-8 lg:sticky lg:top-6">
          <section aria-labelledby="owe-heading">
            <SectionTitle><span id="owe-heading">{t("budget.settleUp")}</span></SectionTitle>
            <div className="panel divide-y divide-line">
              {oweTotal < 0.01 && owedTotal < 0.01 && (
                <div className="flex items-center gap-3 px-4 py-4">
                  <CheckCircle2 size={18} className="text-positive" aria-hidden="true" />
                  <p className="text-[13px] text-ink-2">{t("budget.allSquare")}</p>
                </div>
              )}
              {Object.entries(iOwe).filter(([, v]) => v > 0.009).map(([uid, v]) => (
                <div key={`o-${uid}`} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={member(uid)?.display_name} src={member(uid)?.avatar_url} size={28} />
                  <p className="min-w-0 flex-1 text-[13px] text-ink-2">{t("budget.youOweName", { name: nameOf(uid) })}</p>
                  <span className="text-[13px] font-semibold text-negative tabular">{formatCurrency(v, cur)}</span>
                </div>
              ))}
              {Object.entries(owedToMe).filter(([, v]) => v > 0.009).map(([uid, v]) => (
                <div key={`r-${uid}`} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={member(uid)?.display_name} src={member(uid)?.avatar_url} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink-2">{t("budget.owesYou", { name: nameOf(uid) })}</p>
                    <p className="text-[13px] font-semibold text-positive tabular">{formatCurrency(v, cur)}</p>
                  </div>
                  <Button size="sm" variant="secondary" loading={settling === uid} onClick={() => confirmReceived(uid)}>
                    <Check size={13} /> {t("budget.received")}
                  </Button>
                </div>
              ))}
            </div>
            {oweTotal > 0.01 && <p className="mt-2 text-[11.5px] text-ink-3">{t("budget.oweHint")}</p>}
          </section>
        </aside>
      </div>
    </>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */
function ExpenseRowItem({ exp, meta, canEdit, onEdit, onRemove, amountOverride, aside }: {
  exp: Expense; meta: React.ReactNode; canEdit: boolean; onEdit?: (e: Expense) => void; onRemove?: (id: string) => void;
  amountOverride?: number; aside?: React.ReactNode;
}) {
  const { t } = useTranslation("common");
  const m = EXPENSE_META[exp.category] ?? EXPENSE_META.other;
  const Icon = m.icon;
  const title = exp.description || t(`budget.categories.${exp.category}`);
  return (
    <li className="group flex items-center gap-3.5 px-4 py-3 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${m.color}14`, color: m.color }}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <button className="min-w-0 flex-1 text-start disabled:cursor-default" disabled={!canEdit} onClick={() => onEdit?.(exp)}>
        <p className="truncate text-[14px] font-medium text-ink">{title}</p>
        <p className="truncate text-[12px] text-ink-3">{meta}</p>
      </button>
      <span className="shrink-0">
        <span className="block text-[14px] font-medium text-ink tabular">{formatCurrency(amountOverride ?? exp.amount, exp.currency)}</span>
        {aside}
      </span>
      {canEdit && onEdit && onRemove && (
        <div className="hidden shrink-0 lg:flex lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button onClick={() => onEdit(exp)} aria-label={t("budget.editAria", { name: title })}
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
            <Pencil size={14} />
          </button>
          <button onClick={() => onRemove(exp.id)} aria-label={t("budget.deleteAria", { name: title })}
                  className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative">
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </li>
  );
}

/** Small "live" indicator: green pulse when the realtime channel is connected. */
export function LiveDot({ live }: { live: boolean }) {
  const { t } = useTranslation("common");
  return (
    <span className="ms-1 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-wider" title={live ? t("live.on") : t("live.off")}>
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive/60" />}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", live ? "bg-positive" : "bg-line-strong")} />
      </span>
      <span className="sr-only">{live ? t("live.on") : t("live.off")}</span>
    </span>
  );
}

function CategoryBar({ items, active, onToggle }: {
  items: { category: string; amount: number }[]; active?: string | null; onToggle?: (c: string | null) => void;
}) {
  const { t } = useTranslation("common");
  const total = items.reduce((s, i) => s + i.amount, 0);
  const byCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    items.forEach(e => { totals[e.category] = (totals[e.category] ?? 0) + e.amount; });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [items]);
  if (!byCategory.length || total <= 0) return null;
  return (
    <div className="border-t border-line bg-paper/60 px-5 py-4 sm:px-6">
      <div className="flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
        {byCategory.map(([cat, amt]) => (
          <span key={cat} style={{ width: `${(amt / total) * 100}%`, backgroundColor: EXPENSE_META[cat]?.color }}
                className="h-full border-e-2 border-surface last:border-e-0" />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("budget.filterCategory")}>
        {byCategory.map(([cat, amt]) => {
          const content = (
            <>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EXPENSE_META[cat]?.color }} aria-hidden="true" />
              {t(`budget.categories.${cat}`)}
              <span className={cn("font-mono text-[11px]", active === cat ? "text-paper/60" : "text-ink-3")}>{Math.round((amt / total) * 100)}%</span>
            </>
          );
          const cls = cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                         active === cat ? "border-ink bg-ink text-paper" : "border-transparent text-ink-2", onToggle && active !== cat && "hover:bg-sunken");
          return onToggle
            ? <button key={cat} onClick={() => onToggle(active === cat ? null : cat)} aria-pressed={active === cat} className={cls}>{content}</button>
            : <span key={cat} className={cls}>{content}</span>;
        })}
      </div>
    </div>
  );
}

/* ── Add / edit expense ──────────────────────────────────────────────────── */
type SplitMode = "equal" | "exact" | "shares";

function ExpenseDialog({ trip, members, userId, expense, scope: initialScope, canEditGroup, existingSplits, nameOf, onClose, onDelete, onSaved }: {
  trip: TripRow; members: Member[]; userId: string; expense: Expense | null; scope: Scope; canEditGroup: boolean;
  existingSplits: Split[]; nameOf: (uid: string) => string; onClose: () => void; onDelete?: () => void; onSaved: (e: Expense, s: Split[]) => void;
}) {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>(expense?.scope ?? (initialScope === "group" && !canEditGroup ? "personal" : initialScope));
  const [form, setForm] = useState({
    description: expense?.description ?? "",
    amount: expense ? String(expense.amount) : "",
    category: (expense?.category ?? "food") as Expense["category"],
    date: expense?.date ?? toISODate(new Date()),
    paid_by: expense?.paid_by ?? userId,
  });
  const existingEqual = existingSplits.length > 0 &&
    existingSplits.every(s => Math.abs(Number(s.share_amount) - Number(existingSplits[0].share_amount)) <= 0.011);
  const [mode, setMode] = useState<SplitMode>(existingSplits.length && !existingEqual ? "exact" : "equal");
  const [between, setBetween] = useState<string[]>(existingSplits.length ? existingSplits.map(s => s.user_id) : members.map(m => m.user_id));
  const [exact, setExact] = useState<Record<string, string>>(
    Object.fromEntries(existingSplits.map(s => [s.user_id, String(s.share_amount)])));
  const [weights, setWeights] = useState<Record<string, string>>({});

  const amount = Math.round((parseFloat(form.amount) || 0) * 100) / 100;
  const toggle = (id: string) => setBetween(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]);

  /** Per-person amounts for the current mode, or null when they don't add up. */
  const shares = useMemo((): Record<string, number> | null => {
    if (!between.length || !(amount > 0)) return null;
    if (mode === "equal") {
      const parts = splitByWeights(amount, between.map(() => 1));
      return Object.fromEntries(between.map((u, i) => [u, parts[i]]));
    }
    if (mode === "shares") {
      const w = between.map(u => Math.max(0, parseFloat(weights[u] ?? "1") || 0));
      if (w.every(x => x === 0)) return null;
      const parts = splitByWeights(amount, w);
      return Object.fromEntries(between.map((u, i) => [u, parts[i]]));
    }
    return Object.fromEntries(between.map(u => [u, Math.round((parseFloat(exact[u] ?? "") || 0) * 100) / 100]));
  }, [between, amount, mode, weights, exact]);
  const assigned = shares ? Object.values(shares).reduce((a, b) => a + b, 0) : 0;
  const diff = Math.round((amount - assigned) * 100) / 100;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!(amount > 0)) { setError(t("budget.errors.amount")); return; }
    if (scope === "group") {
      if (between.length === 0) { setError(t("budget.errors.nobody")); return; }
      if (!shares) { setError(t("budget.errors.shares")); return; }
      if (mode === "exact" && Math.abs(diff) > 0.009) {
        setError(t("budget.errors.mismatch", { amount: formatCurrency(Math.abs(diff), trip.currency), dir: diff > 0 ? t("budget.short") : t("budget.over") }));
        return;
      }
    }
    setLoading(true); setError(null);
    const supabase = createClient();
    const payload = {
      paid_by: scope === "personal" ? userId : form.paid_by, amount, currency: trip.currency, category: form.category,
      description: form.description.trim().slice(0, 200) || null, date: form.date, scope,
    };
    let saved: Expense;
    if (expense) {
      const { data, error: err } = await supabase.from("expenses").update(payload).eq("id", expense.id).select().single();
      if (err || !data) { setError(t("budget.errors.save")); setLoading(false); return; }
      saved = data as Expense;
      await supabase.from("expense_splits").delete().eq("expense_id", expense.id);
    } else {
      const { data, error: err } = await supabase.from("expenses").insert({ ...payload, trip_id: trip.id }).select().single();
      if (err || !data) { setError(t("budget.errors.save")); setLoading(false); return; }
      saved = data as Expense;
    }
    const expenseId = saved.id;
    let savedSplits: Split[] = [];
    if (scope === "group" && shares) {
      const { data: sp, error: splitErr } = await supabase.from("expense_splits").insert(between.map(uid => ({
        expense_id: expenseId!, user_id: uid, share_amount: shares[uid] ?? 0,
        // the payer's own share is never "owed", so it's settled from the start
        is_settled: uid === payload.paid_by,
      }))).select();
      if (splitErr) { setLoading(false); setError(t("budget.errors.save")); return; }
      savedSplits = (sp ?? []) as Split[];
    }
    setLoading(false);
    toast.success(expense ? t("budget.updated") : t("budget.added"));
    onSaved(saved, savedSplits);
    onClose();
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }} title={expense ? t("budget.editExpense") : t("budget.addExpense")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>

        {!expense && (
          <Segmented label={t("budget.expenseType")} value={scope} onChange={setScope} className="w-full [&>button]:flex-1 [&>button]:justify-center"
            options={[
              ...(canEditGroup ? [{ id: "group" as Scope, label: t("budget.tabs.group"), icon: Users }] : []),
              { id: "personal" as Scope, label: t("budget.personal"), icon: Lock },
            ]} />
        )}
        <p className="-mt-2 text-[12px] text-ink-3">{scope === "group" ? t("budget.groupExplain") : t("budget.personalExplain")}</p>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label={t("budget.amount")} htmlFor="ex-amount">
            <Input id="ex-amount" type="number" inputMode="decimal" min="0" step="0.01" autoFocus required
                   value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                   placeholder="0.00" className="text-[15px]" />
          </Field>
          <Field label={t("trip.currency")}>
            <div className="flex h-10 items-center rounded-[var(--radius-control)] border border-line bg-paper px-3 font-mono text-[13px] text-ink-2">{trip.currency}</div>
          </Field>
        </div>

        <Field label={t("budget.description")} htmlFor="ex-desc" optional>
          <Input id="ex-desc" value={form.description} placeholder={t("budget.descriptionPlaceholder")} maxLength={200}
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

        <div className={cn("grid gap-3", scope === "group" ? "grid-cols-2" : "grid-cols-1")}>
          {scope === "group" && (
            <Field label={t("budget.paidBy")} htmlFor="ex-paid">
              <Select id="ex-paid" value={form.paid_by} onChange={e => setForm(f => ({ ...f, paid_by: e.target.value }))}>
                {members.map(m => <option key={m.user_id} value={m.user_id}>{nameOf(m.user_id)}</option>)}
              </Select>
            </Field>
          )}
          <Field label={t("budget.date")} htmlFor="ex-date">
            <Input id="ex-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
        </div>

        {scope === "group" && (
          <fieldset className="rounded-[12px] border border-line p-3">
            <legend className="px-1 text-[13px] font-medium text-ink">{t("budget.splitBetween")}</legend>
            <div className="mb-3 flex gap-1" role="radiogroup" aria-label={t("budget.splitMode")}>
              {(["equal", "exact", "shares"] as SplitMode[]).map(m => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                        className={cn("h-7 flex-1 rounded-full text-[12px] transition-colors",
                                      mode === m ? "bg-ink text-paper" : "bg-sunken text-ink-2 hover:text-ink")}>
                  {t(`budget.modes.${m}`)}
                </button>
              ))}
            </div>
            <ul className="space-y-1.5">
              {members.map(m => {
                const on = between.includes(m.user_id);
                return (
                  <li key={m.user_id} className="flex items-center gap-2">
                    <button type="button" aria-pressed={on} onClick={() => toggle(m.user_id)}
                            className={cn("flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-[12.5px] transition-colors",
                                          on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:bg-sunken")}>
                      <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={24} />
                      <span className="truncate">{nameOf(m.user_id)}</span>
                      {on && <Check size={13} className="ms-auto shrink-0" aria-hidden="true" />}
                    </button>
                    {on && mode === "exact" && (
                      <Input type="number" inputMode="decimal" min="0" step="0.01" className="h-9 w-28 text-end"
                             value={exact[m.user_id] ?? ""} placeholder="0.00" aria-label={t("budget.amountFor", { name: nameOf(m.user_id) })}
                             onChange={e => setExact(x => ({ ...x, [m.user_id]: e.target.value }))} />
                    )}
                    {on && mode === "shares" && (
                      <Input type="number" inputMode="numeric" min="0" step="1" className="h-9 w-20 text-end"
                             value={weights[m.user_id] ?? "1"} aria-label={t("budget.sharesFor", { name: nameOf(m.user_id) })}
                             onChange={e => setWeights(x => ({ ...x, [m.user_id]: e.target.value }))} />
                    )}
                    {on && mode !== "exact" && shares && (
                      <span className="w-24 shrink-0 text-end font-mono text-[12px] text-ink-3">{formatCurrency(shares[m.user_id] ?? 0, trip.currency)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <div className="flex gap-3">
                <button type="button" className="text-ink-2 underline-offset-2 hover:underline" onClick={() => setBetween(members.map(m => m.user_id))}>{t("budget.everyone")}</button>
                <button type="button" className="text-ink-2 underline-offset-2 hover:underline" onClick={() => setBetween([form.paid_by])}>{t("budget.onlyPayer")}</button>
                {mode === "exact" && amount > 0 && between.length > 0 && (
                  <button type="button" className="text-ink-2 underline-offset-2 hover:underline" onClick={() => {
                    const parts = splitByWeights(amount, between.map(() => 1));
                    setExact(Object.fromEntries(between.map((u, i) => [u, String(parts[i])])));
                  }}>{t("budget.fillEqually")}</button>
                )}
              </div>
              {mode === "exact" && amount > 0 && (
                <span className={cn("font-mono", Math.abs(diff) > 0.009 ? "text-negative" : "text-positive")}>
                  {Math.abs(diff) > 0.009
                    ? t("budget.leftToAssign", { amount: formatCurrency(diff, trip.currency) })
                    : t("budget.balanced")}
                </span>
              )}
            </div>
          </fieldset>
        )}

        <ModalActions>
          {onDelete && <Button type="button" variant="danger" className="sm:me-auto" onClick={onDelete}><Trash2 size={14} /> {t("common.delete")}</Button>}
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" loading={loading}>{expense ? t("common.save") : t("budget.addExpense")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
