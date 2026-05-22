"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  LayoutDashboard, Map, Wallet, Package, FileText,
  LogOut, ChevronLeft, ChevronRight, Plane, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "./language-switcher";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip    = Database["public"]["Tables"]["trips"]["Row"];

interface SidebarProps { tripId?: string }

// Per-section accent colors
const NAV_COLORS: Record<string, { active: string; text: string; dot: string }> = {
  dashboard: { active: "bg-blue-600",   text: "text-blue-600",   dot: "bg-blue-500"  },
  itinerary: { active: "bg-indigo-600", text: "text-indigo-600", dot: "bg-indigo-500"},
  budget:    { active: "bg-amber-500",  text: "text-amber-600",  dot: "bg-amber-500" },
  packing:   { active: "bg-emerald-600",text: "text-emerald-600",dot: "bg-emerald-500"},
  documents: { active: "bg-purple-600", text: "text-purple-600", dot: "bg-purple-500" },
};

export function Sidebar({ tripId }: SidebarProps) {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const router   = useRouter();
  const [collapsed,    setCollapsed]    = useState(false);
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [recentTrips,  setRecentTrips]  = useState<Trip[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("*").eq("id", user.id).single()
        .then(({ data }) => setProfile(data));
      supabase.from("trip_members").select("trip_id").eq("user_id", user.id)
        .then(async ({ data: rows }) => {
          if (!rows?.length) return;
          const ids = rows.map(r => r.trip_id);
          const { data: trips } = await supabase
            .from("trips").select("*").in("id", ids)
            .order("created_at", { ascending: false }).limit(4);
          setRecentTrips(trips ?? []);
        });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tripNavItems = tripId ? [
    { href: `/trips/${tripId}`,           icon: LayoutDashboard, label: t("nav.dashboard"), key: "dashboard" },
    { href: `/trips/${tripId}/itinerary`, icon: Map,             label: t("nav.itinerary"), key: "itinerary" },
    { href: `/trips/${tripId}/budget`,    icon: Wallet,          label: t("nav.budget"),    key: "budget"    },
    { href: `/trips/${tripId}/packing`,   icon: Package,         label: t("nav.packing"),   key: "packing"   },
    { href: `/trips/${tripId}/documents`, icon: FileText,        label: t("nav.docs"),      key: "documents" },
  ] : [
    { href: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), key: "dashboard" },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <aside className={cn(
      "hidden lg:flex flex-col h-screen sticky top-0 bg-white border-r border-slate-100",
      "transition-all duration-250 shrink-0 z-20",
      collapsed ? "w-[60px]" : "w-[220px]"
    )}>

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className={cn(
        "flex items-center gap-2.5 px-3.5 py-4 border-b border-slate-100",
        collapsed && "justify-center px-2"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl sky-gradient flex items-center justify-center shrink-0
                          shadow-sm shadow-blue-200">
            <Plane size={15} className="text-white -rotate-45"/>
          </div>
          {!collapsed && (
            <span className="font-extrabold text-blue-700 text-[15px] truncate"
                  style={{ fontFamily: "var(--font-heading)" }}>
              Travera
            </span>
          )}
        </Link>
      </div>

      {/* ── User info ─────────────────────────────────────────────── */}
      {!collapsed && profile && (
        <div className="px-3.5 py-3 border-b border-slate-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full sky-gradient flex items-center justify-center
                          text-white text-xs font-bold shrink-0 shadow-sm">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.display_name ?? "User"}
                     className="w-full h-full rounded-full object-cover"/>
              : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-800 truncate"
               style={{ fontFamily: "var(--font-body)" }}>
              {profile.display_name ?? "Traveler"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">{recentTrips.length} trips</p>
          </div>
        </div>
      )}

      {/* ── Trip breadcrumb ───────────────────────────────────────── */}
      {tripId && !collapsed && (
        <div className="px-3.5 py-2 border-b border-slate-100">
          <Link href="/dashboard"
                className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1
                           transition-colors font-medium">
            <ChevronLeft size={12}/> All trips
          </Link>
        </div>
      )}

      {/* ── Main nav ──────────────────────────────────────────────── */}
      <nav className="flex-1 py-2.5 px-2 space-y-0.5 overflow-y-auto scrollbar-hide"
           aria-label="Main navigation">
        {tripNavItems.map(({ href, icon: Icon, label, key }) => {
          const isExact = href === `/trips/${tripId}` || href === "/dashboard";
          const active  = isExact ? pathname === href : pathname.startsWith(href);
          const colors  = NAV_COLORS[key] ?? NAV_COLORS.dashboard;
          return (
            <Link key={href} href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium",
                    "transition-all duration-150",
                    active ? `${colors.active} text-white shadow-sm`
                           : `text-slate-500 hover:bg-slate-50 hover:text-slate-800`,
                    collapsed && "justify-center px-2"
                  )}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}>
              <Icon size={15} aria-hidden="true" className="shrink-0"/>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Recent trips (when not in a trip) */}
        {!tripId && !collapsed && recentTrips.length > 0 && (
          <div className="pt-3">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-2.5 mb-1.5">
              Recent
            </p>
            {recentTrips.map(trip => (
              <Link key={trip.id} href={`/trips/${trip.id}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px]
                               text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors">
                <div className="w-5 h-5 rounded-lg sky-gradient flex items-center justify-center shrink-0">
                  <Plane size={10} className="text-white -rotate-45"/>
                </div>
                <span className="truncate">{trip.title}</span>
              </Link>
            ))}
          </div>
        )}

        {/* New trip button */}
        {!tripId && !collapsed && (
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-create-trip"))}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-xl text-[13px]
                       text-blue-600 hover:bg-blue-50 transition-colors mt-1 font-semibold
                       cursor-pointer">
            <Plus size={14}/> New Trip
          </button>
        )}
        {!tripId && collapsed && (
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("open-create-trip"))}
            className="flex items-center justify-center w-full py-2 rounded-xl
                       text-blue-600 hover:bg-blue-50 transition-colors"
            title="New Trip">
            <Plus size={16}/>
          </button>
        )}
      </nav>

      {/* ── Bottom ────────────────────────────────────────────────── */}
      <div className="border-t border-slate-100 p-2 space-y-0.5">
        {!collapsed && <LanguageSwitcher className="w-full"/>}
        <button onClick={handleSignOut}
                className={cn(
                  "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-[13px] font-medium",
                  "text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors",
                  collapsed && "justify-center px-2"
                )}
                aria-label={t("nav.signOut")} title={collapsed ? t("nav.signOut") : undefined}>
          <LogOut size={14} aria-hidden="true"/>
          {!collapsed && <span>{t("nav.signOut")}</span>}
        </button>
        <button onClick={() => setCollapsed(c => !c)}
                className="flex items-center justify-center w-full py-1.5 rounded-xl
                           text-slate-300 hover:bg-slate-50 hover:text-slate-500 transition-colors
                           text-xs font-medium"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed
            ? <ChevronRight size={14}/>
            : <><ChevronLeft size={14}/><span className="ml-1">Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
