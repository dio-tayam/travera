"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { createClient } from "@/lib/supabase/client";

interface Props { tripId: string }

export function MobileTripHeader({ tripId }: Props) {
  void tripId;
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="lg:hidden shrink-0 flex items-center justify-between px-3 py-2
                    bg-white border-b border-slate-100 z-20">
      {/* Back to main dashboard */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-sm font-semibold
                   text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
        aria-label="Back to all trips"
      >
        <ChevronLeft size={17} className="text-blue-500 shrink-0"/>
        <span style={{ fontFamily: "var(--font-heading)" }}>All Trips</span>
      </Link>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <LanguageSwitcher/>
        <button
          onClick={handleSignOut}
          className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500
                     active:bg-red-100 transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={16}/>
        </button>
      </div>
    </div>
  );
}
