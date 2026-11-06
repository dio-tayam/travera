import type { Metadata } from "next";
import { Toaster } from "sonner";
import { requireAdmin } from "@/lib/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { AutoRefresh } from "@/components/shared/live-refresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Travera" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <AdminShell email={user.email ?? ""}>
      {children}
      <AutoRefresh everyMs={30_000} />
      <Toaster position="bottom-right" closeButton toastOptions={{ duration: 3500 }} />
    </AdminShell>
  );
}
