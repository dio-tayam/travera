"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { ArrowRight, Eye, Route } from "lucide-react";
import { formatDateRange, parseDate, tripLength } from "@/lib/utils";
import { StopCard } from "@/components/shared/stop-card";
import { DayStrip } from "@/components/shared/day-strip";
import { LazyTripMap } from "@/components/shared/lazy-trip-map";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Figure } from "@/components/ui/primitives";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface Props {
  trip: Trip;
  owner: { display_name: string | null; avatar_url: string | null } | null;
  days: Day[];
  stops: Stop[];
}

export function ShareViewClient({ trip, owner, days, stops }: Props) {
  const { t } = useTranslation("common");
  const [selected, setSelected] = useState<string | null>(days[0]?.id ?? null);

  const dayIndex = days.findIndex(d => d.id === selected);
  const day = days[dayIndex];
  const dayStops = useMemo(
    () => stops.filter(s => s.day_id === selected).sort((a, b) => a.order_index - b.order_index),
    [stops, selected]
  );
  const length = tripLength(trip.start_date, trip.end_date);

  return (
    <div className="min-h-dvh bg-paper">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Link href="/login" aria-label="Travera"><Logo size={26} /></Link>
          <Badge tone="outline" className="ml-1 hidden sm:inline-flex"><Eye size={12} /> {t("share.readOnly")}</Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageSwitcher variant="compact" />
            <Button asChild size="sm">
              <Link href="/login">Plan your own <ArrowRight size={14} /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-12 animate-rise">
        {/* Hero */}
        <div className="flex items-center gap-2.5">
          <Avatar name={owner?.display_name} src={owner?.avatar_url} size={24} />
          <p className="text-[13px] text-ink-2">{t("share.sharedBy", { name: owner?.display_name ?? "a traveler" })}</p>
        </div>
        <h1 className="display mt-4 text-[40px] text-ink text-balance sm:text-[56px]">{trip.title}</h1>

        {trip.cover_image_url && (
          <div className="mt-6 h-48 overflow-hidden rounded-[var(--radius-panel)] border border-line bg-sunken sm:h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={trip.cover_image_url} alt="" className="h-full w-full object-cover" decoding="async" />
          </div>
        )}

        <div className="panel mt-6 grid grid-cols-2 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-4">
          <Figure label={t("trip.destination")} value={trip.destination ?? "—"} />
          <Figure label="Dates" valueClassName="whitespace-normal" value={trip.start_date && trip.end_date ? formatDateRange(trip.start_date, trip.end_date) : "—"} />
          <Figure label="Length" value={length ? `${length} days` : `${days.length} days`} />
          <Figure label="Stops" value={stops.length} />
        </div>

        {/* Itinerary */}
        <section className="mt-12" aria-labelledby="itin-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t("nav.itinerary")}</p>
              <h2 id="itin-heading" className="display mt-2 text-[32px] text-ink">
                {day ? `Day ${dayIndex + 1}` : "No days planned yet"}
                {day?.date && (
                  <span className="text-ink-3"> · {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(parseDate(day.date))}</span>
                )}
              </h2>
            </div>
          </div>

          {days.length > 0 && <DayStrip days={days} selected={selected} onSelect={setSelected} className="mt-5 pb-1" />}

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="order-2 lg:order-1">
              {dayStops.length === 0 ? (
                <div className="panel grid-texture flex flex-col items-center px-6 py-12 text-center">
                  <Route size={20} className="text-ink-3" aria-hidden="true" />
                  <p className="mt-3 text-[13px] text-ink-2">No stops planned for this day.</p>
                </div>
              ) : (
                <ol>
                  {dayStops.map((stop, i) => <StopCard key={stop.id} stop={stop} index={i} readOnly />)}
                </ol>
              )}
            </div>
            <div className="order-1 h-64 overflow-hidden rounded-[var(--radius-panel)] border border-line sm:h-80 lg:order-2 lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
              <LazyTripMap stops={dayStops} />
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 flex flex-col items-start justify-between gap-5 rounded-[var(--radius-panel)] bg-ink px-6 py-8 text-paper sm:flex-row sm:items-center sm:px-8">
          <div>
            <p className="display text-[30px]">Planning a trip of your own?</p>
            <p className="mt-1 text-[14px] text-paper/60">Itinerary, budget, packing and documents — shared with your whole group. Free.</p>
          </div>
          <Button asChild variant="accent" size="lg">
            <Link href="/login">Start planning <ArrowRight size={16} /></Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
