export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const authError = searchParams.get("error") || searchParams.get("error_code") || searchParams.get("error_description");
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
    // Keep the browser message generic, but retain the useful cause in Netlify function logs.
    console.error("Supabase OAuth code exchange failed", {
      name: error.name,
      code: "code" in error ? error.code : undefined,
      message: error.message,
    });
  } else if (!authError) {
    console.error("Supabase OAuth callback did not include an authorization code");
  }

  return NextResponse.redirect(`${origin}/login?error=${authError ? "auth_denied" : "auth_failed"}`);
}
