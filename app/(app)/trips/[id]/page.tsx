import { createClient } from "@/lib/supabase/server";
import { requireTrip } from "@/lib/trip-access";
import { TripDetailClient } from "./trip-detail-client";

export const dynamic = "force-dynamic";

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ trip, membership }, { data: members }] = await Promise.all([
    requireTrip(id),
    supabase.from("trip_members").select("*, profiles(*)").eq("trip_id", id),
  ]);

  return <TripDetailClient trip={trip} membership={membership} members={members ?? []} />;
}
