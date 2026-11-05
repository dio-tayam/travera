import { createClient } from "@/lib/supabase/server";
import { requireTrip } from "@/lib/trip-access";
import { BudgetClient } from "./budget-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Budget" };

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ trip, user, canEdit }, { data: members }, { data: expenses }] = await Promise.all([
    requireTrip(id),
    supabase.from("trip_members").select("*, profiles(*)").eq("trip_id", id),
    supabase.from("expenses").select("*").eq("trip_id", id).order("date", { ascending: false }),
  ]);

  const { data: splits } = expenses?.length
    ? await supabase.from("expense_splits").select("*").in("expense_id", expenses.map(e => e.id))
    : { data: [] };

  return (
    <BudgetClient trip={trip} members={members ?? []} initialExpenses={expenses ?? []}
                  initialSplits={splits ?? []} userId={user.id} canEdit={canEdit} />
  );
}
