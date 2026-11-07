"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowRight, ChevronRight, Compass, Plus } from "lucide-react";
import { CreateTripDialog } from "@/components/shared/create-trip-dialog";
import { LiveRefresh } from "@/components/shared/live-refresh";
import { TripPass, tripStatus } from "@/components/shared/trip-pass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal, ModalActions } from "@/components/ui/modal";
import { toast } from "sonner";
import { PageBody, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { cn, daysUntil, formatDateRange, formatLongDate, isPastTrip, tripLength } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Trip = Database["public"]["Tables"]["trips"]["Row"] & { memberCount: number };
interface Props { profile: Profile | null; trips: Trip[]; userId: string }

export function DashboardClient({ profile, trips, userId }: Props) {
  const { t } = useTranslation("common");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const open = () => setShowCreate(true);
    document.addEventListener("open-create-trip", open);
    return () => document.removeEventListener("open-create-trip", open);
  }, []);

  useEffect(() => {
    const open = () => setShowJoin(true);
    document.addEventListener("open-join-trip", open);
    return () => document.removeEventListener("open-join-trip", open);
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

  async function joinWithCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    const response = await fetch("/api/trips/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: inviteCode.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    setJoining(false);
    if (!response.ok) {
      toast.error(t(`invite.errors.${result.code ?? "failed"}`, { defaultValue: t("invite.errors.failed") }));
      return;
    }
    if (result.status === "alreadyMember") {
      toast.success(t("invite.alreadyJoined"));
      if (result.tripId) window.location.href = `/trips/${result.tripId}`;
      return;
    }
    toast.success(t("invite.joined"));
    if (result.tripId) window.location.href = `/trips/${result.tripId}`;
  }

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
          <section id="trip-tools" className="panel mt-8 overflow-hidden">
            <div className="grid-texture px-6 py-10 text-center sm:py-12">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink-2">
                <Compass size={18} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[17px] font-semibold text-ink">{t("dashboard.noTripsTitle")}</h2>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-2">{t("dashboard.noTrips")}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setShowCreate(true)}><Plus size={16} /> {t("dashboard.planFirst")}</Button>
                <Button variant="secondary" onClick={() => setShowJoin(true)}>
                  <ArrowRight size={15} /> {t("invite.joinWithCode")}
                </Button>
              </div>
            </div>
            <div className="grid border-t border-line sm:grid-cols-4">
              {(["itinerary", "budget", "packing", "docs"] as const).map((feature, index) => (
                <div key={feature} className={cn("px-4 py-4 text-center", index > 0 && "border-t border-line sm:border-s sm:border-t-0")}>
                  <p className="text-[12.5px] font-medium text-ink">{t(`nav.${feature}`)}</p>
                  <p className="mt-1 text-[11px] text-ink-3">{t(`dashboard.feature_${feature}`)}</p>
                </div>
              ))}
            </div>
          </section>
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
      <Modal open={showJoin} onOpenChange={setShowJoin} title={t("invite.joinWithCode")} description={t("invite.codeHint")}>
        <form onSubmit={joinWithCode} className="space-y-3" noValidate>
          <label htmlFor="join-trip-code" className="block text-[13px] font-medium text-ink">{t("invite.codeTitle")}</label>
          <Input id="join-trip-code" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                 placeholder={t("invite.codePlaceholder")} autoComplete="off" autoFocus className="font-mono" />
          <ModalActions>
            <Button type="button" variant="ghost" onClick={() => setShowJoin(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={joining} disabled={!inviteCode.trim()}><ArrowRight size={15} /> {t("invite.join")}</Button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}
