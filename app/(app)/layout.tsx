import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { Toaster } from "sonner";

// Signed-in app pages are private — keep them out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, supabase] = await Promise.all([getUser(), createClient()]);
  if (!user) redirect("/login");
  // Suspended accounts are also blocked by RLS; this just shows them why.
  const { data: suspended } = await supabase.rpc("is_suspended");
  if (suspended === true) redirect("/suspended");

  return (
    <>
      {children}
      <Toaster position="bottom-right" closeButton toastOptions={{ duration: 3500 }} offset={20} mobileOffset={{ bottom: 84 }} />
    </>
  );
}
