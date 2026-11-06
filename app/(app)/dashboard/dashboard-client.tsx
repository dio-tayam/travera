"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ChevronRight, Compass, Plus } from "lucide-react";
import { CreateTripDialog } from "@/components/shared/create-trip-dialog";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { TripPass, tripStatus } from "@/components/shared/trip-pass";
import { Button } from "@/components/ui/button";
import { EmptyState, PageBody, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { daysUntil, formatDateRange, formatLongDate, isPastTrip, tripLength } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"] & { memberCount: number };
interface Props { profile: Profile | null; trips: Trip[]; userId: string }

export function DashboardClient({ profile, trips, userId }: Props) {
  const { t } = useTranslation("common");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const open = () => setShowCreate(true);
    document.addEventListener("open-create-trip", open);
    return () => document.removeEventListener("open-create-trip", open);
  }, []);

  const name = profile?.display_name?.split(" ")[0] ?? t("common.traveler");

  const { upcoming, past, next, stats } = useMemo(() => {
    const upcoming = trips
      .filter(tr => !isPastTrip(tr.end_date))
      .sort((a, b) => (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999"));
    const past = trips
      .filter(tr => isPastTrip(tr.end_date))
      .sort((a, b) => (b.end_date ?? "").localeCompare(a.end_date ?? ""));
    const next = upcoming.find(tr => tr.start_date && daysUntil(tr.start_date) >= 0) ?? null;
    const lengths = trips.map(tr => tripLength(tr.start_date, tr.end_date)).filter((n): n is number => !!n);
    const stats = [
      { label: t("dashboard.totalTrips"),    value: trips.length },
      { label: t("dashboard.destinations"),  value: new Set(trips.map(tr => tr.destination).filter(Boolean)).size },
      { label: t("dashboard.collaborative"), value: trips.filter(tr => tr.memberCount > 1).length },
      { label: t("dashboard.avgDuration"),
        value: lengths.length ? t("dashboard.avgDays", { n: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) }) : "—" },
    ];
    return { upcoming, past, next, stats };
  }, [trips, t]);

  const newTripButton = (
    <Button onClick={() => setShowCreate(true)}>
      <Plus size={16} aria-hidden="true" /> {t("dashboard.newTrip")}
    </Button>
  );

  return (
    <>
      <PageBody>
        <LiveRefresh channel={`dashboard:${userId}`} specs={[
          { table: "trip_members", filter: `user_id=eq.${userId}` },
          { table: "trips" },
        ]} />
        <PageHeader
          eyebrow={<span suppressHydrationWarning>
            {formatLongDate(new Date())}
          </span>}
          title={t("dashboard.greeting", { name })}
          description={next
            ? <>{t("dashboard.nextUp")} <span className="font-medium text-ink">{next.title}</span> — <span suppressHydrationWarning>{tripStatus(next, t).label}</span></>
            : trips.length === 0 ? t("dashboard.whereNext") : undefined}
          actions={newTripButton}
        />

        {trips.length > 0 && (
          <dl className="panel mt-8 grid grid-cols-2 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label}
                   className={[
                     "px-5 py-4",
                     i % 2 === 1 ? "border-l border-line" : "",
                     i >= 2 ? "border-t border-line sm:border-t-0" : "",
                     i === 2 ? "sm:border-l" : "",
                   ].join(" ")}>
                <dt className="eyebrow">{s.label}</dt>
                <dd className="display mt-2 text-[32px] text-ink tabular">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {trips.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={Compass}
            title={t("dashboard.noTripsTitle")}
            description={t("dashboard.noTrips")}
            action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> {t("dashboard.planFirst")}</Button>}
          />
        ) : (
          <>
            <section className="mt-10" aria-labelledby="upcoming-heading">
              <SectionTitle meta={upcoming.length}><span id="upcoming-heading">{t("dashboard.upcomingTitle")}</span></SectionTitle>
              {upcoming.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map(trip => <TripPass key={trip.id} trip={trip} />)}
                </div>
              ) : (
                <div className="panel flex flex-col items-start justify-between gap-3 px-5 py-5 sm:flex-row sm:items-center">
                  <p className="text-[13px] text-ink-2">{t("dashboard.nothingPlanned")}</p>
                  {newTripButton}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section className="mt-10" aria-labelledby="past-heading">
                <SectionTitle meta={past.length}><span id="past-heading">{t("dashboard.pastTrips")}</span></SectionTitle>
                <ul className="panel divide-y divide-line overflow-hidden">
                  {past.map(trip => (
                    <li key={trip.id}>
                      <Link href={`/trips/${trip.id}`}
                            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-paper">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-ink">{trip.title}</p>
                          <p className="truncate text-[12.5px] text-ink-3">{trip.destination ?? "—"}</p>
                        </div>
                        {trip.start_date && trip.end_date && (
                          <span suppressHydrationWarning className="hidden font-mono text-[11.5px] text-ink-3 sm:block">
                            {formatDateRange(trip.start_date, trip.end_date)}
                          </span>
                        )}
                        <ChevronRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </PageBody>

      <CreateTripDialog open={showCreate} onClose={() => setShowCreate(false)} userId={userId} />
    </>
  );
}
