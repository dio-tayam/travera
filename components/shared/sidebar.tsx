"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Plane } from "lucide-react";
import { cn, formatDateRange, formatShortDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
import { ModeSwitcher } from "./mode-switcher";
import { Logo, LogoMark } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/primitives";
import { tripNavItems, isActive, type TripSummary } from "./nav-items";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type RecentTrip = Pick<TripSummary, "id" | "title" | "start_date">;

const COLLAPSE_KEY = "travera:sidebar-collapsed";

export function Sidebar({ trip }: { trip?: TripSummary | null }) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recent, setRecent] = useState<RecentTrip[]>([]);
  const [tripCount, setTripCount] = useState(0);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    // getSession reads the local session — no network round-trip before the queries.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user.id;
      if (!uid) return;
      const [{ data: p }, { data: rows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("trip_members").select("trip_id").eq("user_id", uid),
      ]);
      if (cancelled) return;
      setProfile(p);
      const ids = (rows ?? []).map((r: { trip_id: string }) => r.trip_id);
      setTripCount(ids.length);
      if (!ids.length) return;
      const { data: trips } = await supabase.from("trips")
        .select("id,title,start_date").in("id", ids)
        .order("created_at", { ascending: false }).limit(5);
      if (!cancelled) setRecent(trips ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  function toggle() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  }

  // ⌘B / Ctrl+B toggles the sidebar (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "b") return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items = trip ? tripNavItems(trip.id) : [];

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-e border-line bg-paper lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[252px]"
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        {collapsed ? (
          // Collapsed: the logo turns into the expand button on hover/focus, in the same spot as "collapse".
          <button onClick={toggle} aria-label={t("sidebar.expand")} title={t("sidebar.expand")}
                  className="group/expand relative grid h-10 w-10 place-items-center rounded-[var(--radius-control)] transition-colors hover:bg-sunken">
            <LogoMark size={26} className="transition-opacity group-hover/expand:opacity-0 group-focus-visible/expand:opacity-0" />
            <PanelLeftOpen size={18} className="absolute text-ink opacity-0 transition-opacity group-hover/expand:opacity-100 group-focus-visible/expand:opacity-100" />
          </button>
        ) : (
          <>
            <Link href="/dashboard" aria-label={t("sidebar.home")}><Logo /></Link>
            <button onClick={toggle} aria-label={t("sidebar.collapse")} title={t("sidebar.collapse")}
                    className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-none px-3 pb-4" aria-label={t("sidebar.main")}>
        {trip ? (
          <>
            <NavLink href="/dashboard" icon={ArrowLeft} label={t("sidebar.allTrips")} collapsed={collapsed} muted />
            {!collapsed && (
              <div className="mx-2 mb-3 mt-5">
                <p className="eyebrow">{t("sidebar.currentTrip")}</p>
                <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{trip.title}</p>
                {trip.start_date && trip.end_date && (
                  <p suppressHydrationWarning className="mt-1 font-mono text-[11px] text-ink-3">
                    {formatDateRange(trip.start_date, trip.end_date)}
                  </p>
                )}
              </div>
            )}
            <div className={cn("space-y-0.5", collapsed && "mt-3")}>
              {items.map(item => (
                <NavLink key={item.href} href={item.href} icon={item.icon} label={t(item.labelKey)}
                         active={isActive(pathname, item)} collapsed={collapsed} />
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("open-create-trip"))}
              className={cn(
                "mb-4 flex h-10 w-full items-center gap-2 rounded-[var(--radius-control)] bg-ink text-[13px] font-medium text-paper",
                "transition-colors hover:bg-[#2a2d35]",
                collapsed ? "justify-center" : "px-3"
              )}
              aria-label={t("dashboard.newTrip")}
              title={collapsed ? t("dashboard.newTrip") : undefined}
            >
              <Plus size={16} aria-hidden="true" />
              {!collapsed && t("dashboard.newTrip")}
            </button>
            <NavLink href="/dashboard" icon={Plane} label={t("dashboard.myTrips")}
                     active={pathname === "/dashboard"} collapsed={collapsed} />

            {!collapsed && recent.length > 0 && (
              <div className="mt-6">
                <p className="eyebrow mx-2 mb-2">{t("sidebar.recent")}</p>
                <ul className="space-y-0.5">
                  {recent.map(r => (
                    <li key={r.id}>
                      <Link href={`/trips/${r.id}`}
                            className="flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                        <span className="flex-1 truncate">{r.title}</span>
                        {r.start_date && (
                          <span suppressHydrationWarning className="font-mono text-[10.5px] text-ink-3">{formatShortDate(r.start_date)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-line p-3">
        {collapsed ? (
          <>
            <ModeSwitcher variant="compact" className="mx-auto" />
            <LanguageSwitcher variant="compact" side="top" className="mx-auto" />
            <button onClick={signOut} aria-label={t("nav.signOut")} title={t("nav.signOut")}
                    className="mx-auto grid h-9 w-9 place-items-center rounded-[var(--radius-control)] text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <ModeSwitcher />
            <LanguageSwitcher side="top" />
            <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2">
              <Avatar name={profile?.display_name} src={profile?.avatar_url} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{profile?.display_name ?? " "}</p>
                <p className="font-mono text-[10.5px] text-ink-3">{t("sidebar.tripCount", { count: tripCount })}</p>
              </div>
              <button onClick={signOut} aria-label={t("nav.signOut")} title={t("nav.signOut")}
                      className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-sunken hover:text-negative">
                <LogOut size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function NavLink({ href, icon: Icon, label, active, collapsed, muted }: {
  href: string; icon: React.ElementType; label: string;
  active?: boolean; collapsed?: boolean; muted?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-[var(--radius-control)] text-[13.5px] transition-colors",
        collapsed ? "justify-center" : "px-2.5",
        active
          ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]"
          : muted ? "text-ink-3 hover:text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
      )}
    >
      {active && <span className="absolute -start-3 top-2 bottom-2 w-[3px] rounded-e-full bg-accent" aria-hidden="true" />}
      <Icon size={16} aria-hidden="true" className={cn("shrink-0", active && "text-accent")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
