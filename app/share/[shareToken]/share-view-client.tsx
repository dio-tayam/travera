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
import { MapPin, Calendar, Lock } from "lucide-react";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface ShareViewClientProps {
  trip: Trip;
  owner: { display_name: string | null; avatar_url: string | null } | null;
  days: Day[];
  stops: Stop[];
}

export function ShareViewClient({ trip, owner, days, stops }: ShareViewClientProps) {
  const { t } = useTranslation("common");
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);

  const dayStops = stops.filter((s) => s.day_id === selectedDayId);
  const allStops = stops.filter((s) => s.lat && s.lng);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Top banner */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--color-primary)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <Lock size={16} className="text-white flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p
              className="text-white font-semibold text-sm truncate"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {t("share.viewing", { title: trip.title })}
            </p>
            <p
              className="text-white/70 text-xs"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("share.sharedBy", { name: owner?.display_name ?? "Anonymous" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LanguageSwitcher className="text-white" />
          <Link
            href="/login"
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--color-gold)", color: "var(--color-primary)", fontFamily: "var(--font-body)" }}
          >
            {t("share.cta")}
          </Link>
        </div>
      </div>

      {/* Cover */}
      <div className="relative h-48 overflow-hidden">
        {trip.cover_image_url ? (
          <img src={trip.cover_image_url} alt={trip.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: "var(--color-primary)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            {trip.title}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            {trip.destination && (
              <span className="flex items-center gap-1 text-white/80 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                <MapPin size={13} aria-hidden="true" /> {trip.destination}
              </span>
            )}
            {trip.start_date && trip.end_date && (
              <span className="flex items-center gap-1 text-white/80 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                <Calendar size={13} aria-hidden="true" />
                {formatDateRange(trip.start_date, trip.end_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Itinerary read-only */}
      <div className="flex flex-col lg:flex-row gap-0 flex-1">
        <div className="w-full lg:w-[420px] lg:flex-shrink-0">
          {/* Day pills */}
          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {days.map((day, idx) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id)}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
                  style={
                    selectedDayId === day.id
                      ? { backgroundColor: "var(--color-gold)", color: "var(--color-primary)" }
                      : { backgroundColor: "#f1f5f9", color: "#64748b" }
                  }
                >
                  {t("itinerary.day", { number: idx + 1 })}
                </button>
              ))}
            </div>
          </div>

          {/* Stops */}
          <div className="p-4 space-y-3 bg-white min-h-[300px]">
            {dayStops.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8" style={{ fontFamily: "var(--font-body)" }}>
                No stops for this day.
              </p>
            ) : (
              dayStops.map((stop, idx) => (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  index={idx}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  readOnly
                />
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="hidden lg:block flex-1 h-[calc(100vh-340px)] min-h-64">
          <TripMap stops={allStops} />
        </div>
      </div>

      {/* CTA footer */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
            {t("share.readOnly")} · Powered by Travera
          </p>
        </div>
        <Link
          href="/login"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
        >
          {t("share.cta")}
        </Link>
      </div>
    </div>
  );
}
