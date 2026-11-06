"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

type Result = { ok: true } | { ok: false; error: string };

/** Every action re-verifies admin access here and again inside the SECURITY DEFINER RPC. */
async function run(fn: (s: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) => PromiseLike<{ error: { message: string } | null }>, path: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await fn(supabase);
  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function setAdminAccess(userId: string, grant: boolean): Promise<Result> {
  if (!UUID.test(userId)) return { ok: false, error: "Invalid user" };
  return run(s => s.rpc("admin_set_admin", { p_user: userId, p_grant: grant }), "/admin/users");
}

export async function setSuspended(userId: string, suspend: boolean, reason?: string): Promise<Result> {
  if (!UUID.test(userId)) return { ok: false, error: "Invalid user" };
  return run(s => s.rpc("admin_set_suspended", { p_user: userId, p_suspend: suspend, p_reason: reason?.slice(0, 500) ?? null }), "/admin/users");
}

export async function unpublishTrip(tripId: string): Promise<Result> {
  if (!UUID.test(tripId)) return { ok: false, error: "Invalid trip" };
  return run(s => s.rpc("admin_unpublish_trip", { p_trip_id: tripId }), "/admin/trips");
}
