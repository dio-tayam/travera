export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { PackingClient } from "./packing-client";

export default async function PackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const { data: membership } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", id)
    .eq("user_id", user.id)
    .single();
  if (!membership) notFound();

  const { data: members } = await supabase
    .from("trip_members")
    .select("*, profiles(*)")
    .eq("trip_id", id);

  const { data: items } = await supabase
    .from("packing_items")
    .select("*")
    .eq("trip_id", id)
    .order("order_index", { ascending: true });

  return (
    <PackingClient
      trip={trip}
      members={members ?? []}
      initialItems={items ?? []}
      userId={user.id}
      canEdit={membership.role === "owner" || membership.role === "editor"}
    />
  );
}
