import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite travelers" }, { status: 401 });
  const { data: owner } = await supabase.from("trip_members").select("role").eq("trip_id", id).eq("user_id", user.id).maybeSingle();
  if (owner?.role !== "owner") return NextResponse.json({ error: "Only the trip owner can invite travelers" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (email === user.email?.toLowerCase()) return NextResponse.json({ error: "You are already the trip owner" }, { status: 400 });
  const { data: trip } = await supabase.from("trips").select("title").eq("id", id).single();
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  // Existing accounts are added immediately. New accounts proceed through the email invite flow below.
  const { data: addedExisting, error: addError } = await supabase.rpc("add_registered_trip_member", {
    p_trip_id: id,
    p_email: email,
  });
  if (addError) return NextResponse.json({ error: "Couldn't add this traveler. Apply the existing member migration and try again." }, { status: 500 });
  if (addedExisting) return NextResponse.json({ ok: true, added: true });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Invitations are not configured yet" }, { status: 503 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const response = await fetch(`${url}/auth/v1/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ email, redirect_to: `${new URL(request.url).origin}/auth/callback?next=/dashboard`, data: { trip_id: id, trip_title: trip.title, invited_by: user.user_metadata?.full_name ?? user.email } }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && !String(result.msg ?? result.message ?? "").toLowerCase().includes("already registered")) {
    return NextResponse.json({ error: result.msg ?? result.message ?? "Email invitation could not be sent" }, { status: 502 });
  }
  const { error } = await supabase.from("trip_invitations").upsert({ trip_id: id, email, role: "editor", invited_by: user.id }, { onConflict: "trip_id,email" });
  if (error) return NextResponse.json({ error: "Invitation was emailed, but could not be saved. Apply the trip invitation migration." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
