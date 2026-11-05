"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/logo";
import type { TripSummary } from "./nav-items";

/** Top bar for screens below `lg`. Shows the logo, or a back link + trip title inside a trip. */
export function MobileTopBar({ trip }: { trip?: TripSummary | null }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-paper/95 px-2 backdrop-blur-md lg:hidden">
      {trip ? (
        <>
          <Link href="/dashboard" aria-label="All trips"
                className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] text-ink-2 hover:bg-sunken">
            <ChevronLeft size={20} />
          </Link>
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{trip.title}</p>
        </>
      ) : (
        <Link href="/dashboard" className="flex-1 px-2" aria-label="Travera home">
          <Logo size={26} />
        </Link>
      )}
      <LanguageSwitcher variant="compact" />
      <button onClick={signOut} aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-sunken hover:text-ink">
        <LogOut size={17} />
      </button>
    </header>
  );
}
