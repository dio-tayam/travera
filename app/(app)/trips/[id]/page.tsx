import { loadMembers, requireTrip } from "@/lib/trip-access";
import type {
  AuditLogRow, DocumentRow, ExpenseRow, ItineraryDayRow, PackingItemRow, StopRow, TripInvitationRow,
} from "@/types/database";
import { TripDetailClient, type OverviewData } from "./trip-detail-client";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireTrip(id);
  const { supabase, user, trip, isOwner } = access;

  // RLS already limits every query below to what this traveler may see
  // (group rows + their own personal/private rows).
  const [members, days, stops, expenses, mySplits, packing, docs, activity, invitations, myBudget] = await Promise.all([
    loadMembers(supabase, id),
    supabase.from("itinerary_days").select("id, day_number, date").eq("trip_id", id).order("day_number"),
    supabase.from("stops").select("id, day_id, title, type, start_time, address, order_index").eq("trip_id", id),
    supabase.from("expenses").select("id, amount, scope, paid_by, created_by").eq("trip_id", id),
    supabase.from("expense_splits").select("expense_id, share_amount, is_settled, user_id").eq("user_id", user.id),
    supabase.from("packing_items").select("id, is_packed, scope, assigned_to, created_by").eq("trip_id", id),
    supabase.from("documents").select("id, type, visibility, uploaded_by").eq("trip_id", id),
    supabase.from("audit_logs").select("*").eq("trip_id", id).order("created_at", { ascending: false }).limit(25),
    isOwner
      ? supabase.from("trip_invitations").select("*").eq("trip_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("member_budgets").select("amount").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
  ]);

  const data: OverviewData = {
    days: (days.data ?? []) as Pick<ItineraryDayRow, "id" | "day_number" | "date">[],
    stops: (stops.data ?? []) as Pick<StopRow, "id" | "day_id" | "title" | "type" | "start_time" | "address" | "order_index">[],
    expenses: (expenses.data ?? []) as Pick<ExpenseRow, "id" | "amount" | "scope" | "paid_by" | "created_by">[],
    mySplits: (mySplits.data ?? []) as { expense_id: string; share_amount: number; is_settled: boolean; user_id: string }[],
    packing: (packing.data ?? []) as Pick<PackingItemRow, "id" | "is_packed" | "scope" | "assigned_to" | "created_by">[],
    docs: (docs.data ?? []) as Pick<DocumentRow, "id" | "type" | "visibility" | "uploaded_by">[],
    activity: (activity.data ?? []) as AuditLogRow[],
    invitations: (invitations.data ?? []) as TripInvitationRow[],
    myBudget: (myBudget.data as { amount: number } | null)?.amount ?? null,
  };

  return (
    <TripDetailClient trip={trip} role={access.role} userId={user.id} members={members} data={data} />
  );
}
