import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Role, TripRow } from "@/types/database";
import type { Member } from "@/lib/types";

export type TripAccess = {
  role: Role;
  /** Owner or editor: may change the group itinerary, budget, packing list and documents. */
  canEdit: boolean;
  /** Owner: trip settings, sharing, travelers. */
  isOwner: boolean;
};

export function accessFor(role: Role): TripAccess {
  return { role, canEdit: role === "owner" || role === "editor", isOwner: role === "owner" };
}

/**
 * Loads a trip plus the current user's membership in parallel.
 * Redirects to /login when signed out; 404s when the trip is missing or not shared with the user.
 * RLS enforces the same rules in the database — this only shapes the UI.
 */
export async function requireTrip(id: string) {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");

  const [{ data: trip }, { data: membership }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", id).maybeSingle(),
    supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!trip || !membership) notFound();

  return {
    supabase, user, trip: trip as TripRow, membership: membership as { role: Role },
    ...accessFor((membership as { role: Role }).role),
  };
}

/** Members of a trip with their profiles, owner first. */
export async function loadMembers(supabase: Awaited<ReturnType<typeof createClient>>, tripId: string) {
  const { data } = await supabase.from("trip_members").select("id, user_id, role, profiles(*)").eq("trip_id", tripId);
  const order: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 };
  return ((data ?? []) as unknown as Member[]).sort((a, b) => order[a.role] - order[b.role]);
}
