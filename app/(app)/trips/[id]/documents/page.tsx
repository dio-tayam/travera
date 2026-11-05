import { createClient } from "@/lib/supabase/server";
import { requireTrip } from "@/lib/trip-access";
import { DocumentsClient } from "./documents-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ trip, user, canEdit }, { data: docs }, { data: members }] = await Promise.all([
    requireTrip(id),
    supabase.from("documents").select("*").eq("trip_id", id),
    supabase.from("trip_members").select("*, profiles(*)").eq("trip_id", id),
  ]);

  return (
    <DocumentsClient trip={trip} initialDocs={docs ?? []} members={members ?? []}
                     userId={user.id} canEdit={canEdit} />
  );
}
