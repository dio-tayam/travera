"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { CreateTripDialog } from "@/components/shared/create-trip-dialog";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import type { Database } from "@/types/database";
import { Plus, Plane, MapPin, Calendar, Users, Clock, Globe, TrendingUp, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateRange } from "@/lib/utils";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"] & { memberCount: number };
interface Props { profile: Profile | null; trips: Trip[]; userId: string }

function TripCard({ trip }: { trip: Trip }) {
  const isPast = trip.end_date && new Date(trip.end_date) < new Date();
  return (
    <Link href={`/trips/${trip.id}`}
          className="card card-hover block overflow-hidden group focus-visible:ring-2
                     focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-2xl">
      <div className="relative h-36 bg-slate-100 overflow-hidden">
        {trip.cover_image_url
          ? <img src={trip.cover_image_url} alt={trip.title}
                 className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
          : <div className="w-full h-full sky-gradient flex items-center justify-center">
              <Plane size={36} className="text-white/20 -rotate-45"/>
            </div>}
        <div className="absolute inset-0"
             style={{ background: "linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 60%)" }}/>
        {isPast && (
          <span className="absolute top-2.5 left-2.5 text-[11px] px-2 py-0.5 rounded-full
                           font-semibold bg-black/55 text-white tracking-wide">Past</span>
        )}
        {trip.memberCount > 1 && (
          <span className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px]
                           px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm font-medium">
            <Users size={10}/> {trip.memberCount}
          </span>
        )}
      </div>
      <div className="p-3.5 space-y-1.5">
        <p className="font-bold text-slate-900 text-[14px] line-clamp-1 leading-snug"
           style={{ fontFamily: "var(--font-heading)" }}>{trip.title}</p>
        {trip.destination && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={11} className="text-blue-400 shrink-0"/> {trip.destination}
          </p>
        )}
        {trip.start_date && trip.end_date && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Calendar size={11} className="shrink-0"/> {formatDateRange(trip.start_date, trip.end_date)}
          </p>
        )}
      </div>
    </Link>
  );
}

export function DashboardClient({ profile, trips, userId }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    const handler = () => setShowCreate(true);
    document.addEventListener("open-create-trip", handler);
    return () => document.removeEventListener("open-create-trip", handler);
  }, []);

  const name      = profile?.display_name?.split(" ")[0] ?? "Traveler";
  const upcoming  = trips.filter(t => !t.end_date || new Date(t.end_date) >= new Date());
  const past      = trips.filter(t =>  t.end_date && new Date(t.end_date) <  new Date());

  const uniqueDestinations = new Set(trips.filter(t => t.destination).map(t => t.destination!)).size;
  const collaborativeTrips = trips.filter(t => t.memberCount > 1).length;
  const durations = trips
    .filter(t => t.start_date && t.end_date)
    .map(t => Math.ceil((new Date(t.end_date!).getTime() - new Date(t.start_date!).getTime()) / 86400000));
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const stats = [
    { label: t("dashboard.totalTrips"),   value: trips.length,          icon: Plane,  color: "#2563eb", bg: "#eff6ff" },
    { label: t("dashboard.destinations"), value: uniqueDestinations,    icon: Globe,  color: "#8b5cf6", bg: "#f5f3ff" },
    { label: t("dashboard.collaborative"),value: collaborativeTrips,    icon: Users,  color: "#f59e0b", bg: "#fffbeb" },
    { label: t("dashboard.avgDuration"),  value: avgDuration > 0 ? `${avgDuration}d` : "—", icon: Clock, color: "#10b981", bg: "#ecfdf5" },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--color-background)" }}>

      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white
                      border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl sky-gradient flex items-center justify-center">
            <Plane size={15} className="text-white -rotate-45"/>
          </div>
          <span className="font-extrabold text-blue-700 text-base"
                style={{ fontFamily: "var(--font-heading)" }}>Travera</span>
        </div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher/>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500
                       active:bg-red-100 transition-colors"
            aria-label={t("nav.signOut")}
          >
            <LogOut size={16}/>
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 animate-fade-in">

        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl sky-gradient px-5 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-white"
                  style={{ fontFamily: "var(--font-heading)" }}>
                {t("dashboard.greeting", { name })} ✈️
              </h1>
              <p className="text-white/70 text-sm mt-0.5">
                {trips.length === 0
                  ? "Ready for your next adventure?"
                  : `${upcoming.length} upcoming · ${past.length} past`}
              </p>
            </div>
            <button onClick={() => setShowCreate(true)}
                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm
                               font-semibold bg-white/20 hover:bg-white/30 text-white border
                               border-white/20 transition-all active:scale-95 shrink-0">
              <Plus size={14}/> New Trip
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.08] pointer-events-none">
            <Plane size={88} className="-rotate-45 text-white"/>
          </div>
        </div>

        {/* Analytics stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="card p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                     style={{ backgroundColor: bg }}>
                  <Icon size={14} style={{ color }} aria-hidden="true"/>
                </div>
                <span className="text-xs text-slate-500 font-medium leading-tight">{label}</span>
              </div>
              <p className="text-2xl font-bold leading-none"
                 style={{ color, fontFamily: "var(--font-heading)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Trend row — only when there are trips */}
        {trips.length > 0 && (
          <div className="card p-4 rounded-2xl flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500"/>
              <span className="text-sm font-semibold text-slate-700"
                    style={{ fontFamily: "var(--font-heading)" }}>{t("dashboard.tripInsights")}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>
                {upcoming.length} {t("dashboard.upcoming")}
              </span>
              <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/>
                {past.length} {t("dashboard.completed")}
              </span>
              {avgDuration > 0 && (
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                  <Clock size={11}/> {t("dashboard.avgDaysTrip", { n: avgDuration })}
                </span>
              )}
              {uniqueDestinations > 0 && (
                <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                  <Globe size={11}/> {t(`dashboard.destinationsCount_${uniqueDestinations === 1 ? "one" : "other"}`, { count: uniqueDestinations })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900"
              style={{ fontFamily: "var(--font-heading)" }}>
            {t("dashboard.myTrips")}
            {trips.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">({trips.length})</span>
            )}
          </h2>
          <button onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold
                             text-white sky-gradient hover:opacity-90 transition-all active:scale-95
                             shadow-sm shadow-blue-200">
            <Plus size={14}/> New Trip
          </button>
        </div>

        {/* No trips */}
        {trips.length === 0 && (
          <div className="card flex flex-col items-center justify-center py-14 text-center rounded-2xl">
            <div className="w-16 h-16 rounded-2xl sky-gradient flex items-center justify-center
                            mb-4 shadow-lg shadow-blue-200">
              <Plane size={28} className="text-white -rotate-45 animate-float"/>
            </div>
            <p className="font-bold text-slate-900 text-base mb-1.5"
               style={{ fontFamily: "var(--font-heading)" }}>No trips yet</p>
            <p className="text-slate-500 text-sm mb-5 max-w-xs"
               style={{ fontFamily: "var(--font-body)" }}>
              {t("dashboard.noTrips")}
            </p>
            <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm
                               font-semibold sky-gradient shadow-md shadow-blue-200
                               hover:opacity-90 transition-all hover:-translate-y-0.5 active:scale-95">
              <Plus size={15}/> Plan your first trip
            </button>
          </div>
        )}

        {/* Upcoming grid */}
        {upcoming.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {upcoming.map(trip => <TripCard key={trip.id} trip={trip}/>)}
          </div>
        )}

        {/* Past trips */}
        {past.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              {t("dashboard.pastTrips")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 opacity-65">
              {past.map(trip => <TripCard key={trip.id} trip={trip}/>)}
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button onClick={() => setShowCreate(true)}
              className="lg:hidden fixed bottom-20 right-4 w-13 h-13 rounded-full shadow-xl
                         sky-gradient flex items-center justify-center text-white z-20
                         hover:opacity-90 active:scale-95 transition-all"
              aria-label={t("dashboard.createTrip")}>
        <Plus size={22}/>
      </button>

      <CreateTripDialog open={showCreate} onClose={() => setShowCreate(false)} userId={userId}/>
    </div>
  );
}
