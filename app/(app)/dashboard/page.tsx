import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trips" };

export default async function DashboardPage() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");

  const [{ data: existingProfile }, { data: memberRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("trip_members").select("trip_id").eq("user_id", user.id),
  ]);

  let profile = existingProfile;
  if (!profile) {
    const { data } = await supabase.from("profiles").insert({
      id: user.id,
      display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Traveler",
      avatar_url: user.user_metadata?.avatar_url ?? null,
      home_currency: "PHP",
    }).select().single();
    profile = data;
  }

  const tripIds = (memberRows ?? []).map(r => r.trip_id);
  const [{ data: trips }, { data: allMembers }] = tripIds.length
    ? await Promise.all([
        supabase.from("trips").select("*").in("id", tripIds).order("created_at", { ascending: false }),
        supabase.from("trip_members").select("trip_id").in("trip_id", tripIds),
      ])
    : [{ data: [] }, { data: [] }];

  const counts: Record<string, number> = {};
  (allMembers ?? []).forEach(r => { counts[r.trip_id] = (counts[r.trip_id] ?? 0) + 1; });

  return (
    <DashboardClient
      profile={profile}
      trips={(trips ?? []).map(t => ({ ...t, memberCount: counts[t.id] ?? 1 }))}
      userId={user.id}
    />
  );
}
