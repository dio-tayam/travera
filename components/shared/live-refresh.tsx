"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRealtime, type RealtimeSpec } from "@/lib/use-realtime";

/** Re-fetches the current server-rendered page whenever any of `specs` change. Renders nothing. */
export function LiveRefresh({ channel, specs, debounceMs = 600 }: { channel: string; specs: RealtimeSpec[]; debounceMs?: number }) {
  const router = useRouter();
  useRealtime(channel, specs, () => router.refresh(), { debounceMs });
  return null;
}

/** Polls the server page while the tab is visible (for views Realtime can't reach, e.g. admin aggregates). */
export function AutoRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
