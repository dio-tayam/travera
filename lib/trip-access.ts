import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Loads a trip plus the current user's membership in parallel.
 * Redirects to /login when signed out; 404s when the trip is missing or not shared with the user.
 */
export async function requireTrip(id: string) {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");

  const [{ data: trip }, { data: membership }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).single(),
    supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).single(),
  ]);
  if (!trip || !membership) notFound();

  return {
    supabase, user, trip, membership,
    canEdit: membership.role === "owner" || membership.role === "editor",
  };
}
