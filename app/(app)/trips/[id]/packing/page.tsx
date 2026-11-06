import { loadMembers, requireTrip } from "@/lib/trip-access";
import type { PackingItemRow } from "@/types/database";
import { PackingClient } from "./packing-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packing" };

export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireTrip(id);
  const { supabase, trip, user } = access;
  // RLS returns the group list plus only this traveler's personal items.
  const [{ data: items }, members] = await Promise.all([
    supabase.from("packing_items").select("*").eq("trip_id", id).order("order_index", { ascending: true }),
    loadMembers(supabase, id),
  ]);

  return (
    <PackingClient trip={trip} initialItems={(items ?? []) as PackingItemRow[]} members={members}
                   userId={user.id} canEdit={access.canEdit} />
  );
}
