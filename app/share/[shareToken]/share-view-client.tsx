"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import Link from "next/link";
import type { Database } from "@/types/database";
import { StopCard } from "@/components/shared/stop-card";
import { TripMap } from "@/components/shared/trip-map";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { formatDateRange } from "@/lib/utils";
import { MapPin, Calendar, Lock, Plane, Users } from "lucide-react";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day  = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface Props {
  trip: Trip;
  owner: { display_name: string | null; avatar_url: string | null } | null;
  days: Day[];
  stops: Stop[];
}

export function ShareViewClient({ trip, owner, days, stops }: Props) {
  const { t } = useTranslation("common");
  const [selDay, setSelDay] = useState<string | null>(days[0]?.id ?? null);

  const dayStops = stops
    .filter(s => s.day_id === selDay)
    .sort((a, b) => a.order_index - b.order_index);
  const mapStops = stops.filter(s => s.lat && s.lng);

  return (
    <div className="min-h-screen flex flex-col animate-fade-in" style={{ background: "var(--color-background)" }}>

      {/* Banner */}
      <div className="sky-gradient px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Lock size={14} className="text-white" aria-hidden="true"/>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate"
               style={{ fontFamily: "var(--font-heading)" }}>
              {t("share.viewing", { title: trip.title })}
            </p>
            <p className="text-white/60 text-xs" style={{ fontFamily: "var(--font-body)" }}>
              {t("share.sharedBy", { name: owner?.display_name ?? "Anonymous" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <LanguageSwitcher/>
          <Link href="/login"
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-slate-900
                           hover:bg-amber-300 transition-colors whitespace-nowrap">
            {t("share.cta")}
          </Link>
        </div>
      </div>

      {/* Cover */}
      <div className="relative h-48 lg:h-60 overflow-hidden shrink-0">
        {trip.cover_image_url
          ? <img src={trip.cover_image_url} alt={trip.title} className="w-full h-full object-cover"/>
          : <div className="w-full h-full sky-gradient flex items-center justify-center">
              <Plane size={64} className="text-white/20 -rotate-45" aria-hidden="true"/>
            </div>}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent"/>
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6">
          <h1 className="text-xl lg:text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "var(--font-heading)" }}>{trip.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-white/70">
            {trip.destination && (
              <span className="flex items-center gap-1"><MapPin size={12}/> {trip.destination}</span>
            )}
            {trip.start_date && trip.end_date && (
              <span className="flex items-center gap-1">
                <Calendar size={12}/> {formatDateRange(trip.start_date, trip.end_date)}
              </span>
            )}
            <span className="flex items-center gap-1"><Users size={12}/> Shared trip</span>
          </div>
        </div>
      </div>

      {/* Itinerary */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-full lg:w-100 shrink-0 flex flex-col bg-white border-r border-slate-100">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
              {days.map((day, idx) => (
                <button key={day.id} onClick={() => setSelDay(day.id)}
                        className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold
                                   transition-all whitespace-nowrap"
                        style={selDay === day.id
                          ? { background: "var(--color-primary)", color: "white" }
                          : { background: "#f1f5f9", color: "#64748b" }}>
                  {t("itinerary.day", { number: idx + 1 })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {dayStops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Plane size={32} className="text-slate-200 -rotate-45 mb-3" aria-hidden="true"/>
                <p className="text-sm text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
                  No stops for this day.
                </p>
              </div>
            ) : dayStops.map((stop, idx) => (
              <StopCard key={stop.id} stop={stop} index={idx}
                        onEdit={() => {}} onDelete={() => {}} readOnly/>
            ))}
          </div>
        </div>

        <div className="hidden lg:block flex-1 h-full min-h-64">
          <TripMap stops={mapStops}/>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-slate-100
                      px-4 py-3 flex items-center justify-between z-10">
        <p className="text-xs text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
          Read-only · Powered by Travera ✈️
        </p>
        <Link href="/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold
                         text-white sky-gradient hover:opacity-90 transition-all">
          <Plane size={14} className="-rotate-45"/> Plan your own trip
        </Link>
      </div>
    </div>
  );
}
