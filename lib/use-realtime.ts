"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RealtimeSpec = {
  table: string;
  /** PostgREST-style filter, e.g. `trip_id=eq.<uuid>`. */
  filter?: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
};

/**
 * Live updates for a page: subscribes to Supabase Realtime for `specs` and calls `onChange`
 * (debounced, so an expense + its splits written back-to-back trigger one refetch).
 *
 * Why this exists instead of a bare `supabase.channel()`:
 * - It waits for the browser session and hands its JWT to Realtime before joining. Joining
 *   as anon makes RLS drop every event silently — the "need to reload" bug.
 * - Filtered DELETE events aren't delivered by Supabase, so each filtered table also gets an
 *   unfiltered DELETE listener (payload carries only the primary key).
 * - It catches up after the tab was hidden, the network came back, or the socket rejoined.
 */
export function useRealtime(key: string, specs: RealtimeSpec[], onChange: () => void, opts?: { debounceMs?: number; enabled?: boolean }) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const [live, setLive] = useState(false);
  const specKey = JSON.stringify(specs);
  const debounceMs = opts?.debounceMs ?? 250;
  const enabled = opts?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let joinedOnce = false;
    const fire = () => { clearTimeout(timer); timer = setTimeout(() => { if (!cancelled) cb.current(); }, debounceMs); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      channel = supabase.channel(`${key}:${Math.random().toString(36).slice(2, 8)}`);
      for (const s of JSON.parse(specKey) as RealtimeSpec[]) {
        channel.on("postgres_changes", { event: s.event ?? "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) }, fire);
        if (s.filter && (s.event ?? "*") === "*") channel.on("postgres_changes", { event: "DELETE", schema: "public", table: s.table }, fire);
      }
      channel.subscribe((status: string) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setLive(true);
          if (joinedOnce) fire(); // re-joined after a drop: catch up on anything missed
          joinedOnce = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive(false);
        }
      });
    })();

    // Keep the socket's token current as Supabase refreshes the session.
    const { data: auth } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });
    const onVisible = () => { if (document.visibilityState === "visible") fire(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", fire);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      auth.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", fire);
      if (channel) supabase.removeChannel(channel);
    };
  }, [key, specKey, debounceMs, enabled]);

  return live;
}

/** Re-renders server data (router.refresh) whenever any of the tables change. */
export function useLiveRefresh(key: string, specs: RealtimeSpec[], refresh: () => void, debounceMs = 600) {
  return useRealtime(key, specs, refresh, { debounceMs });
}
