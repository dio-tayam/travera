import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { I18nProvider } from "@/components/shared/i18n-provider";
import { Toaster } from "sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getUser())) redirect("/login");

  return (
    <I18nProvider>
      {children}
      <Toaster position="bottom-right" closeButton toastOptions={{ duration: 3500 }} offset={20} mobileOffset={{ bottom: 84 }} />
    </I18nProvider>
  );
}
