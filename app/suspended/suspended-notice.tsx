"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SuspendedNotice() {
  const { t } = useTranslation("common");
  const router = useRouter();
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="panel max-w-md px-7 py-9 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-negative-soft text-negative">
          <ShieldAlert size={20} aria-hidden="true" />
        </span>
        <h1 className="display mt-5 text-[30px] text-ink">{t("suspended.title")}</h1>
        <p className="mt-2 text-[14px] text-ink-2">{t("suspended.body")}</p>
        <Button className="mt-6" variant="secondary" onClick={async () => {
          await createClient().auth.signOut();
          router.push("/login");
          router.refresh();
        }}>{t("nav.signOut")}</Button>
      </div>
    </main>
  );
}
