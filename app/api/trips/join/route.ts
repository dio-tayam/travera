import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function fail(code: string, status: number) {
  return NextResponse.json({ code }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("signedOut", 401);

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  if (!/^[a-z0-9]{12,64}$/.test(code)) return fail("invalidCode", 400);

  const { data, error } = await supabase.rpc("join_trip_by_code", { p_code: code });
  if (error) {
    console.error("join_trip_by_code failed", error.message);
    return fail("migration", 500);
  }
  const result = data as { status: string; trip_id: string | null } | null;
  if (!result) return fail("invalidCode", 404);
  if (result.status === "suspended") return fail("suspended", 403);
  if (result.status === "already_member") {
    return NextResponse.json({ status: "alreadyMember", tripId: result.trip_id });
  }
  if (result.status !== "joined") return fail("invalidCode", 404);
  return NextResponse.json({ status: "joined", tripId: result.trip_id });
}
