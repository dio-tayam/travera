export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch or create profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Traveler",
        avatar_url: user.user_metadata?.avatar_url ?? null,
        home_currency: "PHP",
      })
      .select()
      .single();
    profile = newProfile;
  }

  // Fetch trips (owned + member)
  const { data: memberRows } = await supabase
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", user.id);

  const tripIds = (memberRows ?? []).map((r) => r.trip_id);

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .in("id", tripIds.length > 0 ? tripIds : ["__none__"])
    .order("created_at", { ascending: false });

  // Fetch member counts
  const tripMemberCounts: Record<string, number> = {};
  if (trips && trips.length > 0) {
    const { data: counts } = await supabase
      .from("trip_members")
      .select("trip_id")
      .in("trip_id", trips.map((t) => t.id));

    (counts ?? []).forEach((row) => {
      tripMemberCounts[row.trip_id] = (tripMemberCounts[row.trip_id] ?? 0) + 1;
    });
  }

  const tripsWithCounts = (trips ?? []).map((t) => ({
    ...t,
    memberCount: tripMemberCounts[t.id] ?? 1,
  }));

  return (
    <DashboardClient
      profile={profile}
      trips={tripsWithCounts}
      userId={user.id}
    />
  );
}
