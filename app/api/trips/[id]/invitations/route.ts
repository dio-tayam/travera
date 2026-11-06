import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Errors carry a `code` the client translates (see `invite.errors.*` in locales). */
function fail(code: string, status: number) {
  return NextResponse.json({ code }, { status });
}

/**
 * Owner adds a traveler by email.
 * - Existing account → added immediately with the chosen role.
 * - No account yet → Supabase sends an invite email; the pending invitation is stored and
 *   accepted automatically when they first sign in (any sign-in method).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("signedOut", 401);

  const { data: me } = await supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  if (me?.role !== "owner") return fail("notOwner", 403);

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body.role === "viewer" ? "viewer" : "editor";
  if (!EMAIL.test(email) || email.length > 254) return fail("invalidEmail", 400);
  if (email === user.email?.toLowerCase()) return fail("self", 400);

  const { data: trip } = await supabase.from("trips").select("title").eq("id", id).single();
  if (!trip) return fail("notFound", 404);

  const { data: status, error: addError } = await supabase.rpc("add_trip_member_by_email", {
    p_trip_id: id, p_email: email, p_role: role,
  });
  if (addError) {
    console.error("add_trip_member_by_email failed", addError.message);
    return fail("migration", 500);
  }
  if (status === "added") return NextResponse.json({ status: "added" });
  if (status === "already_member") return fail("alreadyMember", 409);

  // Not registered yet: store the pending invite first so it is honoured even if the email fails.
  const { error: saveError } = await supabase.from("trip_invitations")
    .upsert({ trip_id: id, email, role, invited_by: user.id }, { onConflict: "trip_id,email" });
  if (saveError) return fail("migration", 500);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ status: "pending", emailed: false });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const response = await fetch(`${url}/auth/v1/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      email,
      redirect_to: `${new URL(request.url).origin}/auth/callback?next=/trips/${id}`,
      data: { trip_id: id, trip_title: trip.title, invited_by: user.user_metadata?.full_name ?? user.email },
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    console.error("Supabase invite email failed", result.msg ?? result.message ?? response.status);
    return NextResponse.json({ status: "pending", emailed: false });
  }
  return NextResponse.json({ status: "pending", emailed: true });
}
