import { loadMembers, requireTrip } from "@/lib/trip-access";
import type { ExpenseRow, ExpenseSplitRow } from "@/types/database";
import { BudgetClient } from "./budget-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Budget" };

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireTrip(id);
  const { supabase, trip, user } = access;

  // RLS returns group expenses plus only this traveler's personal ones.
  const [members, { data: expenses }, { data: myBudget }] = await Promise.all([
    loadMembers(supabase, id),
    supabase.from("expenses").select("*").eq("trip_id", id).order("date", { ascending: false }),
    supabase.from("member_budgets").select("amount").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
  ]);

  const { data: splits } = expenses?.length
    ? await supabase.from("expense_splits").select("*").in("expense_id", expenses.map(e => e.id))
    : { data: [] };

  return (
    <BudgetClient trip={trip} members={members} initialExpenses={(expenses ?? []) as ExpenseRow[]}
                  initialSplits={(splits ?? []) as ExpenseSplitRow[]} userId={user.id} canEdit={access.canEdit}
                  initialMyBudget={(myBudget as { amount: number } | null)?.amount ?? null} />
  );
}
