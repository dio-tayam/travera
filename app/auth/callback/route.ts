export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const authError = searchParams.get("error") || searchParams.get("error_code");
  const requested = searchParams.get("next") ?? "/dashboard";
  // Only allow same-site paths (blocks "//evil.com" or absolute URLs).
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";

  if (!authError && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Accept pending trip invitations after the invited traveler signs in.
      await supabase.rpc("accept_trip_invitations");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${authError ? "auth_denied" : "auth_failed"}`);
}
