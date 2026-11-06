"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// One is_admin() round-trip per session, shared by every component that asks.
let cached: Promise<boolean> | null = null;
let listening = false;

function check() {
  cached ??= Promise.resolve(createClient().rpc("is_admin")).then(r => r.data === true, () => false);
  return cached;
}

/** True when the signed-in user also holds the admin role. UI only — admin RPCs re-check server-side. */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!listening) {
      listening = true;
      createClient().auth.onAuthStateChange(e => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") cached = null; });
    }
    check().then(v => { if (alive) setIsAdmin(v); });
    return () => { alive = false; };
  }, []);
  return isAdmin;
}

export const MODE_COOKIE = "travera_mode";
export function rememberMode(mode: "traveler" | "admin") {
  document.cookie = `${MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}
