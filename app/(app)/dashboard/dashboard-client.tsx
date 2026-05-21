"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { TripCard } from "@/components/shared/trip-card";
import { CreateTripDialog } from "@/components/shared/create-trip-dialog";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import type { Database } from "@/types/database";
import { Plus, MapPin } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"] & { memberCount: number };

interface Props {
  profile: Profile | null;
  trips: Trip[];
  userId: string;
}

export function DashboardClient({ profile, trips, userId }: Props) {
  const { t } = useTranslation("common");
  const [showCreate, setShowCreate] = useState(false);

  const displayName = profile?.display_name ?? "Traveler";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Top bar (mobile) */}
      <div className="lg:hidden flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1="50" y1="50"
                x2={50 + 38 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
                y2={50 + 38 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
                stroke="#FCD116" strokeWidth="7" strokeLinecap="round" />
            ))}
            <circle cx="50" cy="50" r="15" fill="#FCD116" />
          </svg>
          <span className="text-base font-extrabold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}>
            Travera
          </span>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Hero banner */}
      <div
        className="relative overflow-hidden mx-4 lg:mx-6 mt-4 rounded-2xl p-6 lg:p-8"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div className="absolute -right-8 -bottom-8 opacity-10">
          <svg width="160" height="160" viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={i} x1="50" y1="50"
                x2={50 + 45 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
                y2={50 + 45 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
                stroke="#FCD116" strokeWidth="5" strokeLinecap="round" />
            ))}
            <circle cx="50" cy="50" r="16" fill="#FCD116" />
          </svg>
        </div>
        <p
          className="text-white/70 text-sm mb-1"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1
          className="text-2xl lg:text-3xl font-bold text-white"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {t("dashboard.greeting", { name: displayName })} 👋
        </h1>
        <p
          className="text-white/70 text-sm mt-1"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {trips.length === 0
            ? "Ready to plan your next adventure?"
            : `You have ${trips.length} trip${trips.length !== 1 ? "s" : ""} planned`}
        </p>
      </div>

      {/* Trips section */}
      <div className="px-4 lg:px-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}
          >
            {t("dashboard.myTrips")}
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-accent)", fontFamily: "var(--font-body)" }}
            aria-label={t("dashboard.createTrip")}
          >
            <Plus size={16} aria-hidden="true" />
            {t("dashboard.createTrip")}
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin size={48} className="mb-4" style={{ color: "var(--color-muted-foreground)" }} />
            <p className="text-base font-medium mb-2" style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}>
              {t("dashboard.noTrips")}
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-accent)", fontFamily: "var(--font-body)" }}
            >
              {t("dashboard.createTrip")}
            </button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
            {trips.map((trip) => (
              <div key={trip.id} className="snap-start">
                <TripCard trip={trip} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-20 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: "var(--color-accent)" }}
        aria-label={t("dashboard.createTrip")}
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      <CreateTripDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        userId={userId}
      />
    </div>
  );
}
