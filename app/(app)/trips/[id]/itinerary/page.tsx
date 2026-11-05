import { createClient } from "@/lib/supabase/server";
import { requireTrip } from "@/lib/trip-access";
import { ItineraryClient } from "./itinerary-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Itinerary" };

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ trip, user, canEdit }, { data: days }, { data: stops }] = await Promise.all([
    requireTrip(id),
    supabase.from("itinerary_days").select("*").eq("trip_id", id).order("day_number", { ascending: true }),
    supabase.from("stops").select("*").eq("trip_id", id).order("order_index", { ascending: true }),
  ]);

  return (
    <ItineraryClient trip={trip} initialDays={days ?? []} initialStops={stops ?? []}
                     userId={user.id} canEdit={canEdit} />
  );
}
