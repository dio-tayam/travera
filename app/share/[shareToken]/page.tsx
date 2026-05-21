export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShareViewClient } from "./share-view-client";
import { I18nProvider } from "@/components/shared/i18n-provider";

export default async function ShareViewPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("share_token", shareToken)
    .eq("is_public", true)
    .single();

  if (!trip) notFound();

  const { data: owner } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", trip.owner_id)
    .single();

  const { data: days } = await supabase
    .from("itinerary_days")
    .select("*")
    .eq("trip_id", trip.id)
    .order("day_number");

  const { data: stops } = await supabase
    .from("stops")
    .select("*")
    .eq("trip_id", trip.id)
    .order("order_index");

  return (
    <I18nProvider>
      <ShareViewClient
        trip={trip}
        owner={owner}
        days={days ?? []}
        stops={stops ?? []}
      />
    </I18nProvider>
  );
}
