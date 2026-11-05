import { createClient } from "@/lib/supabase/server";
import { requireTrip } from "@/lib/trip-access";
import { PackingClient } from "./packing-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packing" };

export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ trip, user, canEdit }, { data: items }, { data: members }] = await Promise.all([
    requireTrip(id),
    supabase.from("packing_items").select("*").eq("trip_id", id).order("order_index", { ascending: true }),
    supabase.from("trip_members").select("*, profiles(*)").eq("trip_id", id),
  ]);

  return (
    <PackingClient trip={trip} initialItems={items ?? []} members={members ?? []}
                   userId={user.id} canEdit={canEdit} />
  );
}
