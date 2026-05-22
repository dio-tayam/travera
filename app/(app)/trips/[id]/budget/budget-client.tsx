"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/database";
import { Plus, X, Wallet, TrendingUp, TrendingDown, User,
         Plane, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Trip    = Database["public"]["Tables"]["trips"]["Row"];
type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Split   = Database["public"]["Tables"]["expense_splits"]["Row"];
type Member  = {
  user_id: string; role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

const CAT_EMOJI: Record<string, string> = {
  food:"🍜", accommodation:"🏨", transport:"🚌",
  activity:"🎯", shopping:"🛍️", other:"📌",
};

const CAT_META: Record<string, { color: string; bg: string }> = {
  accommodation: { color: "#2563eb", bg: "#eff6ff" },
  food:          { color: "#e11d48", bg: "#fff1f2" },
  transport:     { color: "#64748b", bg: "#f1f5f9" },
  activity:      { color: "#f59e0b", bg: "#fffbeb" },
  shopping:      { color: "#8b5cf6", bg: "#f5f3ff" },
  other:         { color: "#0ea5e9", bg: "#f0f9ff" },
};

function computeSettlements(expenses: Expense[], splits: Split[], members: Member[]) {
  const bal: Record<string,number> = {};
  members.forEach(m => { bal[m.user_id] = 0; });
  expenses.forEach(e => {
    bal[e.paid_by] = (bal[e.paid_by] ?? 0) + Number(e.amount);
    splits.filter(s => s.expense_id === e.id)
      .forEach(s => { bal[s.user_id] = (bal[s.user_id] ?? 0) - Number(s.share_amount); });
  });
  const out: { from:string; to:string; amount:number }[] = [];
  const debtors   = Object.entries(bal).filter(([,b]) => b < -0.01).map(([id,b]) => ({ id, b: Math.abs(b) }));
  const creditors = Object.entries(bal).filter(([,b]) => b >  0.01).map(([id,b]) => ({ id, b }));
  for (const d of debtors) {
    let rem = d.b;
    for (const c of creditors) {
      if (rem < 0.01 || c.b < 0.01) continue;
      const amt = Math.min(rem, c.b);
      out.push({ from: d.id, to: c.id, amount: Math.round(amt * 100) / 100 });
      rem -= amt; c.b -= amt;
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
  const supabase = createClient();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [splits, setSplits]     = useState(initialSplits);
  const [showAdd, setShowAdd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string|null>(null);
  const [form, setForm] = useState({
    description:"", amount:"", currency: trip.currency,
    category:"food" as Expense["category"],
    date: new Date().toISOString().split("T")[0],
    paid_by: userId, split_equally: true,
  });

  useEffect(() => {
    const ch = supabase.channel(`expenses:${trip.id}`)
      .on("postgres_changes",{ event:"*", schema:"public", table:"expenses",
          filter:`trip_id=eq.${trip.id}` }, () => {
        supabase.from("expenses").select("*").eq("trip_id", trip.id)
          .order("date",{ ascending:false }).then(({ data }) => { if (data) setExpenses(data); });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSpent  = expenses.reduce((s,e) => s + Number(e.amount), 0);
  const budget      = trip.total_budget ?? 0;
  const remaining   = budget - totalSpent;
  const myShare     = splits.filter(s => s.user_id === userId)
    .reduce((s, sp) => s + Number(sp.share_amount), 0);
  const settlements = computeSettlements(expenses, splits, members);

  const grouped = expenses.reduce<Record<string,Expense[]>>((acc,e) => {
    const c = e.category ?? "other";
    if (!acc[c]) acc[c] = [];
    acc[c].push(e);
    return acc;
  }, {});

  const getName = (uid: string) =>
    members.find(m => m.user_id === uid)?.profiles?.display_name ?? uid.slice(0,8);

  async function addExpense(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { data: exp, error: err } = await supabase.from("expenses").insert({
        trip_id: trip.id, paid_by: form.paid_by,
        amount: parseFloat(form.amount), currency: form.currency,
        category: form.category, description: form.description || null, date: form.date,
      }).select().single();
      if (err) throw err;

      if (form.split_equally && members.length > 0) {
        const share = Math.round((parseFloat(form.amount) / members.length) * 100) / 100;
        await supabase.from("expense_splits").insert(
          members.map(m => ({ expense_id: exp.id, user_id: m.user_id, share_amount: share, is_settled: false }))
        );
      }
      toast.success("Expense added!");
      setShowAdd(false);
      setForm(f => ({ ...f, description:"", amount:"" }));
      const { data } = await supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date",{ascending:false});
      if (data) setExpenses(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add expense";
      setError(msg);
    } finally { setLoading(false); }
  }

  async function removeExpense(id: string) {
    await supabase.from("expense_splits").delete().eq("expense_id", id);
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses(p => p.filter(e => e.id !== id));
    setSplits(p => p.filter(s => s.expense_id !== id));
    toast.success("Expense removed");
  }

  const spentPct = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  return (
    <div className="h-full overflow-y-auto animate-fade-in" style={{ background:"var(--color-background)" }}>

      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily:"var(--font-heading)" }}>
            {t("nav.budget")}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">{trip.title}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                             text-white budget-gradient hover:opacity-90 transition-all active:scale-95
                             shadow-sm shadow-amber-200">
            <Plus size={15}/> Add expense
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="px-4 lg:px-8 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label:t("budget.totalBudget"), value:formatCurrency(budget,trip.currency),
            icon:Wallet, color:"#2563eb", bg:"#eff6ff", border:"#bfdbfe" },
          { label:t("budget.totalSpent"),  value:formatCurrency(totalSpent,trip.currency),
            icon:TrendingUp, color:"#f59e0b", bg:"#fffbeb", border:"#fde68a" },
          { label:t("budget.remaining"),   value:formatCurrency(remaining,trip.currency),
            icon:TrendingDown, color: remaining>=0?"#10b981":"#ef4444",
            bg: remaining>=0?"#ecfdf5":"#fef2f2",
            border: remaining>=0?"#a7f3d0":"#fecaca" },
          { label:t("budget.yourShare"),   value:formatCurrency(myShare,trip.currency),
            icon:User, color:"#8b5cf6", bg:"#f5f3ff", border:"#ddd6fe" },
        ].map(({ label, value, icon:Icon, color, bg, border }) => (
          <div key={label} className="card p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                   style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
                <Icon size={12} style={{ color }} aria-hidden="true"/>
              </div>
              <span className="text-xs text-slate-500 font-medium truncate">{label}</span>
            </div>
            <p className="text-[18px] font-bold leading-none" style={{ color, fontFamily:"var(--font-heading)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {budget > 0 && (
        <div className="px-4 lg:px-8 mb-5">
          <div className="card p-4 rounded-2xl">
            <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
              <span>Spent: {Math.round(spentPct)}%</span>
              <span>{formatCurrency(totalSpent,trip.currency)} / {formatCurrency(budget,trip.currency)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{
                     width:`${spentPct}%`,
                     background: spentPct >= 100
                       ? "linear-gradient(90deg,#1e3a8a,#2563eb,#0ea5e9)"
                       : spentPct > 70
                       ? "linear-gradient(90deg,#2563eb,#1d4ed8)"
                       : "linear-gradient(90deg,#60a5fa,#2563eb)",
                   }}/>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 lg:px-8 grid lg:grid-cols-2 gap-5 pb-8">
        {/* Expenses */}
        <div className="space-y-3">
          <h2 className="font-bold text-slate-900 text-base" style={{ fontFamily:"var(--font-heading)" }}>
            Expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="card p-10 text-center rounded-2xl">
              <Plane size={36} className="mx-auto text-slate-200 -rotate-45 mb-3" aria-hidden="true"/>
              <p className="text-sm text-slate-400">No expenses yet. Start tracking!</p>
            </div>
          ) : Object.entries(grouped).map(([cat, catExp]) => {
            const meta = CAT_META[cat] ?? CAT_META.other;
            return (
            <div key={cat} className="card overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50"
                   style={{ backgroundColor: meta.bg }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{CAT_EMOJI[cat]}</span>
                  <span className="text-sm font-semibold"
                        style={{ fontFamily:"var(--font-heading)", color: meta.color }}>
                    {t(`budget.categories.${cat}`)}
                  </span>
                </div>
                <span className="text-sm font-bold" style={{ color: meta.color }}>
                  {formatCurrency(catExp.reduce((s,e)=>s+Number(e.amount),0), trip.currency)}
                </span>
              </div>
              {catExp.map(exp => (
                <div key={exp.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50
                                              border-b border-slate-50 last:border-0 group transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {exp.description ?? t(`budget.categories.${exp.category}`)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.date} · {getName(exp.paid_by)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">
                    {formatCurrency(exp.amount, exp.currency)}
                  </span>
                  {canEdit && (
                    <button onClick={() => removeExpense(exp.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg
                                       text-slate-300 hover:text-red-400 transition-all"
                            aria-label="Delete expense">
                      <X size={13}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
          })}
        </div>

        {/* Settlements */}
        <div className="space-y-3">
          <h2 className="font-bold text-slate-900 text-base" style={{ fontFamily:"var(--font-heading)" }}>
            {t("budget.settlements")}
          </h2>
          <div className="card overflow-hidden rounded-2xl">
            {settlements.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-sm text-slate-500 font-semibold">All settled up!</p>
              </div>
            ) : settlements.map((s,i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5
                                      border-b border-slate-50 last:border-0">
                <p className="text-sm">
                  <span className="font-semibold text-red-500">{getName(s.from)}</span>
                  <span className="text-slate-400 mx-1.5">owes</span>
                  <span className="font-semibold text-blue-600">{getName(s.to)}</span>
                </p>
                <span className="text-sm font-bold text-slate-900">
                  {formatCurrency(s.amount, trip.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add expense dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                        p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
             role="dialog" aria-modal="true">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl
                          shadow-2xl animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily:"var(--font-heading)" }}>
                {t("budget.addExpense")}
              </h2>
              <button onClick={() => setShowAdd(false)}
                      className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={18}/>
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 flex gap-2 items-start bg-red-50 border border-red-200
                              rounded-xl p-3 text-sm text-red-700" role="alert">
                <AlertCircle size={15} className="mt-0.5 shrink-0"/><p>{error}</p>
              </div>
            )}

            <form onSubmit={addExpense} className="p-6 space-y-4">
              <input type="text" placeholder="Description (optional)"
                     value={form.description}
                     onChange={e => setForm(f=>({...f,description:e.target.value}))}
                     className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"/>

              <div className="grid grid-cols-2 xs:grid-cols-2 gap-3">
                <input type="number" required min="0" step="0.01" placeholder="Amount"
                       value={form.amount}
                       onChange={e => setForm(f=>({...f,amount:e.target.value}))}
                       className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"/>
                <select value={form.category}
                        onChange={e => setForm(f=>({...f,category:e.target.value as Expense["category"]}))}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                  {Object.keys(CAT_EMOJI).map(c => (
                    <option key={c} value={c}>{CAT_EMOJI[c]} {t(`budget.categories.${c}`)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select value={form.paid_by}
                        onChange={e => setForm(f=>({...f,paid_by:e.target.value}))}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profiles?.display_name ?? "Member"}
                    </option>
                  ))}
                </select>
                <input type="date" value={form.date}
                       onChange={e => setForm(f=>({...f,date:e.target.value}))}
                       className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"/>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={form.split_equally}
                       onChange={e => setForm(f=>({...f,split_equally:e.target.checked}))}
                       className="rounded border-slate-300 text-blue-600 w-4 h-4"/>
                Split equally among all travelers
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                                   font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                                   rounded-xl text-sm font-semibold text-white budget-gradient
                                   disabled:opacity-60 hover:opacity-90 transition-all active:scale-95">
                  {loading && <Plane size={14} className="animate-plane-fly -rotate-45"/>}
                  {loading ? "Adding…" : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
