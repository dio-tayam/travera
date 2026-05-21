"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Database } from "@/types/database";
import { Plus, X, Wallet, TrendingUp, TrendingDown, User } from "lucide-react";
import { toast } from "sonner";
import { TraveraSpinner } from "@/components/shared/travera-spinner";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Expense = Database["public"]["Tables"]["expenses"]["Row"];
type Split = Database["public"]["Tables"]["expense_splits"]["Row"];
type Member = {
  user_id: string;
  role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍜",
  accommodation: "🏨",
  transport: "🚌",
  activity: "🎯",
  shopping: "🛍️",
  other: "📌",
};

interface BudgetClientProps {
  trip: Trip;
  members: Member[];
  initialExpenses: Expense[];
  initialSplits: Split[];
  userId: string;
  canEdit: boolean;
}

interface Settlement {
  from: string;
  to: string;
  amount: number;
}

function computeSettlements(
  expenses: Expense[],
  splits: Split[],
  members: Member[]
): Settlement[] {
  const balances: Record<string, number> = {};
  members.forEach((m) => { balances[m.user_id] = 0; });

  expenses.forEach((expense) => {
    balances[expense.paid_by] = (balances[expense.paid_by] ?? 0) + expense.amount;
    const expSplits = splits.filter((s) => s.expense_id === expense.id);
    expSplits.forEach((split) => {
      balances[split.user_id] = (balances[split.user_id] ?? 0) - split.share_amount;
    });
  });

  const settlements: Settlement[] = [];
  const debtors = Object.entries(balances).filter(([, b]) => b < -0.01);
  const creditors = Object.entries(balances).filter(([, b]) => b > 0.01);

  for (const [debtor, debtAmt] of debtors) {
    let remaining = Math.abs(debtAmt);
    for (const [creditor, credAmt] of creditors) {
      if (remaining < 0.01) break;
      if (credAmt < 0.01) continue;
      const settle = Math.min(remaining, credAmt);
      settlements.push({ from: debtor, to: creditor, amount: Math.round(settle * 100) / 100 });
      remaining -= settle;
    }
  }

  return settlements;
}

export function BudgetClient({
  trip,
  members,
  initialExpenses,
  initialSplits,
  userId,
  canEdit,
}: BudgetClientProps) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: "",
    amount: "",
    currency: trip.currency,
    category: "food" as Expense["category"],
    date: new Date().toISOString().split("T")[0],
    paid_by: userId,
    split_equally: true,
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`expenses:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${trip.id}` }, () => {
        supabase.from("expenses").select("*").eq("trip_id", trip.id).order("date", { ascending: false })
          .then(({ data }) => { if (data) setExpenses(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trip.id, supabase]);

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalBudget = trip.total_budget ?? 0;
  const remaining = totalBudget - totalSpent;
  const myExpenses = expenses.filter((e) => e.paid_by === userId);
  const myTotal = myExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const mySplits = splits.filter((s) => s.user_id === userId);
  const myShare = mySplits.reduce((s, sp) => s + Number(sp.share_amount), 0);

  const settlements = computeSettlements(expenses, splits, members);

  const groupedExpenses = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    const cat = e.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(e);
    return acc;
  }, {});

  function getMemberName(uid: string) {
    const m = members.find((m) => m.user_id === uid);
    return m?.profiles?.display_name ?? uid.slice(0, 8);
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: expense, error } = await supabase
        .from("expenses")
        .insert({
          trip_id: trip.id,
          paid_by: form.paid_by,
          amount: parseFloat(form.amount),
          currency: form.currency,
          category: form.category,
          description: form.description || null,
          date: form.date,
        })
        .select()
        .single();

      if (error) throw error;

      // Split equally among all members
      if (form.split_equally && members.length > 0) {
        const share = parseFloat(form.amount) / members.length;
        await supabase.from("expense_splits").insert(
          members.map((m) => ({
            expense_id: expense.id,
            user_id: m.user_id,
            share_amount: Math.round(share * 100) / 100,
            is_settled: false,
          }))
        );
      }

      toast.success("Expense added!");
      setShowAdd(false);
      setForm((f) => ({ ...f, description: "", amount: "" }));

      // Refresh
      const { data: fresh } = await supabase
        .from("expenses")
        .select("*")
        .eq("trip_id", trip.id)
        .order("date", { ascending: false });
      if (fresh) setExpenses(fresh);
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setLoading(false);
    }
  }

  async function deleteExpense(id: string) {
    await supabase.from("expense_splits").delete().eq("expense_id", id);
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setSplits((prev) => prev.filter((s) => s.expense_id !== id));
    toast.success("Expense deleted");
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <div className="px-4 lg:px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            {t("nav.budget")}
          </h1>
          <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
            {trip.title}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
          >
            <Plus size={16} />
            {t("budget.addExpense")}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="px-4 lg:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("budget.totalBudget"), value: formatCurrency(totalBudget, trip.currency), icon: Wallet, color: "var(--color-primary)" },
          { label: t("budget.totalSpent"), value: formatCurrency(totalSpent, trip.currency), icon: TrendingUp, color: "var(--color-accent)" },
          { label: t("budget.remaining"), value: formatCurrency(remaining, trip.currency), icon: TrendingDown, color: remaining >= 0 ? "#16a34a" : "var(--color-accent)" },
          { label: t("budget.yourShare"), value: formatCurrency(myShare, trip.currency), icon: User, color: "#7c3aed" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl p-4 shadow-sm"
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} style={{ color }} aria-hidden="true" />
              <span className="text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>{label}</span>
            </div>
            <p className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="px-4 lg:px-6 grid lg:grid-cols-2 gap-6">
        {/* Expenses by category */}
        <div className="space-y-4">
          <h2 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>Expenses</h2>
          {Object.entries(groupedExpenses).map(([category, catExpenses]) => (
            <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                <span className="text-base">{CATEGORY_EMOJI[category]}</span>
                <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  {t(`budget.categories.${category}`)}
                </span>
                <span className="ml-auto text-sm font-semibold" style={{ fontFamily: "var(--font-body)", color: "var(--color-primary)" }}>
                  {formatCurrency(catExpenses.reduce((s, e) => s + Number(e.amount), 0), trip.currency)}
                </span>
              </div>
              {catExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-body)" }}>
                      {expense.description ?? t(`budget.categories.${expense.category}`)}
                    </p>
                    <p className="text-xs text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                      {expense.date} · Paid by {getMemberName(expense.paid_by)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
                    {formatCurrency(expense.amount, expense.currency)}
                  </span>
                  {canEdit && expense.paid_by === userId && (
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="text-gray-300 hover:text-red-400 ml-1"
                      aria-label="Delete expense"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                No expenses yet. Start tracking!
              </p>
            </div>
          )}
        </div>

        {/* Settlements */}
        <div className="space-y-4">
          <h2 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>
            {t("budget.settlements")}
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {settlements.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                  All settled up! 🎉
                </p>
              </div>
            ) : (
              settlements.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
                      <span style={{ color: "var(--color-accent)" }}>{getMemberName(s.from)}</span>
                      {" owes "}
                      <span style={{ color: "var(--color-primary)" }}>{getMemberName(s.to)}</span>
                    </p>
                  </div>
                  <span className="text-sm font-bold" style={{ fontFamily: "var(--font-body)", color: "var(--color-primary)" }}>
                    {formatCurrency(s.amount, trip.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add expense dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                {t("budget.addExpense")}
              </h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                  style={{ fontFamily: "var(--font-body)" }}
                  placeholder="Dinner at Ippudo"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                    style={{ fontFamily: "var(--font-body)" }}
                    placeholder="1500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Expense["category"] }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {Object.keys(CATEGORY_EMOJI).map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_EMOJI[cat]} {t(`budget.categories.${cat}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>Paid by</label>
                  <select
                    value={form.paid_by}
                    onChange={(e) => setForm((f) => ({ ...f, paid_by: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.display_name ?? "Member"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                    style={{ fontFamily: "var(--font-body)" }}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                <input
                  type="checkbox"
                  checked={form.split_equally}
                  onChange={(e) => setForm((f) => ({ ...f, split_equally: e.target.checked }))}
                  className="rounded"
                />
                Split equally among all members
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50" style={{ fontFamily: "var(--font-body)" }}>
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}>
                  {loading && <TraveraSpinner size={16} />}
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
