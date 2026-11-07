"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ArrowUpRight, MapPin } from "lucide-react";
import { cn, daysUntil, formatCompactRange, tripLength } from "@/lib/utils";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"] & { memberCount?: number };

export type TripPhase = "tbd" | "upcoming" | "live" | "done";

/** Where a trip stands relative to today. `day` is the current trip day while live. */
export function tripPhase(trip: Pick<Trip, "start_date" | "end_date">): { phase: TripPhase; toStart: number; day: number } {
  if (!trip.start_date) return { phase: "tbd", toStart: 0, day: 0 };
  const toStart = daysUntil(trip.start_date);
  const toEnd = trip.end_date ? daysUntil(trip.end_date) : toStart;
  if (toStart <= 0 && toEnd >= 0) return { phase: "live", toStart, day: 1 - toStart };
  if (toEnd < 0) return { phase: "done", toStart, day: 0 };
  return { phase: "upcoming", toStart, day: 0 };
}

export function tripStatus(trip: Pick<Trip, "start_date" | "end_date">, t: TFunction): { label: string; live: boolean } {
  const { phase, toStart, day } = tripPhase(trip);
  switch (phase) {
    case "tbd": return { label: t("status.tbd"), live: false };
    case "live": return { label: t("status.live", { day }), live: true };
    case "done": return { label: t("status.done"), live: false };
    default: return { label: toStart === 1 ? t("status.tomorrow") : t("status.inDays", { count: toStart }), live: false };
  }
}

/** Trip card styled as a boarding pass. */
export function TripPass({ trip, className }: { trip: Trip; className?: string }) {
  const { t } = useTranslation("common");
  const status = tripStatus(trip, t);
  const days = tripLength(trip.start_date, trip.end_date);

  return (
    <Link href={`/trips/${trip.id}`}
          className={cn("panel panel-interactive group flex flex-col overflow-hidden", className)}>
      {trip.cover_image_url && (
        <div className="relative h-32 overflow-hidden border-b border-line bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={trip.cover_image_url} alt="" loading="lazy" decoding="async"
               referrerPolicy="no-referrer"
               className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
      )}

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p suppressHydrationWarning className={cn("eyebrow flex items-center gap-1.5", status.live && "text-positive")}>
            {status.live && <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />}
            {status.label}
          </p>
          <ArrowUpRight size={16} aria-hidden="true"
                        className="text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink rtl:-scale-x-100" />
        </div>
        <h3 className="display mt-3 line-clamp-2 text-[28px] text-ink">{trip.title}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-2">
          <MapPin size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
          <span className="truncate">{trip.destination ?? t("trip.noDestination")}</span>
        </p>
      </div>

      <div className="perforation" />

      <dl className="grid grid-cols-[1.6fr_1fr_1fr] gap-3 px-5 pb-4 pt-4">
        <div className="min-w-0">
          <dt className="eyebrow">{t("trip.dates")}</dt>
          <dd suppressHydrationWarning className="mt-1 truncate text-[13px] font-medium text-ink tabular">
            {trip.start_date ? formatCompactRange(trip.start_date, trip.end_date) : "—"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">{t("trip.days")}</dt>
          <dd className="mt-1 text-[13px] font-medium text-ink tabular">{days ? String(days).padStart(2, "0") : "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t("trip.crew")}</dt>
          <dd className="mt-1 text-[13px] font-medium text-ink tabular">{trip.memberCount ?? 1}</dd>
        </div>
      </dl>
    </Link>
  );
}
