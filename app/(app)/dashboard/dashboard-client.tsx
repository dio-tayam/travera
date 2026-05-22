"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { CreateTripDialog } from "@/components/shared/create-trip-dialog";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import type { Database } from "@/types/database";
import { Plus, Plane, MapPin, Calendar, Users } from "lucide-react";
import Link from "next/link";
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
      {/* Cover */}
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
      {/* Info */}
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
  const [showCreate, setShowCreate] = useState(false);

  // Listen for "open-create-trip" event dispatched by the sidebar New Trip button
  useEffect(() => {
    const handler = () => setShowCreate(true);
    document.addEventListener("open-create-trip", handler);
    return () => document.removeEventListener("open-create-trip", handler);
  }, []);

  const name    = profile?.display_name?.split(" ")[0] ?? "Traveler";
  const upcoming = trips.filter(t => !t.end_date || new Date(t.end_date) >= new Date());
  const past     = trips.filter(t =>  t.end_date && new Date(t.end_date) <  new Date());

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
        <LanguageSwitcher/>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-5 animate-fade-in">

        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl sky-gradient px-5 py-5 flex
                        items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white"
                style={{ fontFamily: "var(--font-heading)" }}>
              {t("dashboard.greeting", { name })} ✈️
            </h1>
            <p className="text-white/70 text-sm mt-0.5" style={{ fontFamily: "var(--font-body)" }}>
              {trips.length === 0 ? "Ready for your next adventure?" :
               `${upcoming.length} upcoming · ${past.length} past`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[{ n: trips.length, l: "Total" },
              { n: upcoming.length, l: "Upcoming" },
              { n: past.length, l: "Past" }].map(({ n, l }) => (
              <div key={l} className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2
                                      text-center min-w-[54px] border border-white/10">
                <p className="text-white font-bold text-xl leading-none">{n}</p>
                <p className="text-white/60 text-[11px] mt-0.5 font-medium">{l}</p>
              </div>
            ))}
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.08] pointer-events-none">
            <Plane size={88} className="-rotate-45 text-white"/>
          </div>
        </div>

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
              Past Trips
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
