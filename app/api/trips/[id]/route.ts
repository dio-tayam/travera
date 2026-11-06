import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "trip-documents";

/**
 * Owner deletes a trip. Files are removed from Storage first — with the service role (after the
 * ownership check) so travelers' private uploads don't linger; otherwise whatever the owner can reach.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "signedOut" }, { status: 401 });

  const { data: me } = await supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "owner") return NextResponse.json({ code: "notOwner" }, { status: 403 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (serviceKey) {
    const { createClient: createAdmin } = await import("@supabase/supabase-js");
    const admin = createAdmin(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: docs } = await admin.from("documents").select("storage_path").eq("trip_id", id);
    const paths = (docs ?? []).map(d => d.storage_path as string).filter(p => p.startsWith(`${id}/`));
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  } else {
    const { data: docs } = await supabase.from("documents").select("storage_path").eq("trip_id", id);
    const paths = (docs ?? []).map(d => d.storage_path as string);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) return NextResponse.json({ code: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
