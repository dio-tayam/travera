import { loadMembers, requireTrip } from "@/lib/trip-access";
import type { DocumentRow } from "@/types/database";
import { DocumentsClient } from "./documents-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireTrip(id);
  const { supabase, trip, user } = access;
  // RLS returns shared documents plus only this traveler's private ones.
  const [{ data: docs }, members] = await Promise.all([
    supabase.from("documents").select("*").eq("trip_id", id).order("created_at", { ascending: false }),
    loadMembers(supabase, id),
  ]);

  return (
    <DocumentsClient trip={trip} initialDocs={(docs ?? []) as DocumentRow[]} members={members}
                     userId={user.id} canEdit={access.canEdit} isOwner={access.isOwner} />
  );
}
