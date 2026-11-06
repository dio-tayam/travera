import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Guards admin pages. Non-admins get a 404 so the console's existence isn't advertised.
 * Every admin RPC re-checks `is_admin()` in the database, so this is defence in depth.
 */
export async function requireAdmin() {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();
  return { user, supabase };
}

export async function isAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}
