import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { I18nProvider } from "@/components/shared/i18n-provider";
import { Toaster } from "sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <I18nProvider>
      {children}
      <Toaster position="top-right" richColors />
    </I18nProvider>
  );
}
