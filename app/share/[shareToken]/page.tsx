export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SharedTrip } from "@/types/database";
import { ShareViewClient } from "./share-view-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ShareViewPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  if (!/^[a-z0-9]{12,64}$/i.test(shareToken)) notFound();

  // Token-gated RPC: returns only the public itinerary (no budget, travelers or documents).
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_trip", { p_token: shareToken });
  const shared = data as SharedTrip | null;
  if (!shared?.trip) notFound();

  return <ShareViewClient trip={shared.trip} owner={shared.owner} days={shared.days ?? []} stops={shared.stops ?? []} />;
}
