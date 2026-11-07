"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { CalendarPlus, Map as MapIcon, Plus, Route, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { formatLongDate, toISODate, parseDate } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { StopCard } from "@/components/shared/stop-card";
import { DayStrip } from "@/components/shared/day-strip";
import { ConfirmDialog } from "@/components/ui/confirm";
import type { PlaceDraft } from "@/components/shared/trip-map";
import { estimateLeg, formatDistance, formatTravelTime, type Leg } from "@/lib/maps";
import { LazyTripMap } from "@/components/shared/lazy-trip-map";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";

const AddStopDialog = dynamic(() => import("@/components/shared/add-stop-dialog").then(m => m.AddStopDialog), { ssr: false });

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface Props {
  trip: Trip; initialDays: Day[]; initialStops: Stop[];
  userId: string; canEdit: boolean;
}

export function ItineraryClient({ trip, initialDays, initialStops, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [days, setDays] = useState<Day[]>(initialDays);
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [selectedDay, setSelectedDay] = useState<string | null>(initialDays[0]?.id ?? null);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Stop | null; prefill?: PlaceDraft | null }>({ open: false, editing: null });
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [legs, setLegs] = useState<Record<string, Leg>>({});
  const [mapOpen, setMapOpen] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [removingDay, setRemovingDay] = useState<Day | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useRealtime(`itinerary:${trip.id}`, [
    { table: "stops", filter: `trip_id=eq.${trip.id}` },
    { table: "itinerary_days", filter: `trip_id=eq.${trip.id}` },
  ], () => refresh());

  const dayIndex = days.findIndex(d => d.id === selectedDay);
  const day = days[dayIndex];
  const dayStops = useMemo(
    () => stops.filter(s => s.day_id === selectedDay).sort((a, b) => a.order_index - b.order_index),
    [stops, selectedDay]
  );

  // Clear selection and travel info when switching days.
  useEffect(() => { setSelectedStop(null); setLegs({}); }, [selectedDay]);

  /** Travel label to the next located stop: real route from the map, or a straight-line walking estimate. */
  function legLabel(stop: Stop, i: number): { label: string; estimated: boolean; flight: boolean } | null {
    if (stop.lat == null || stop.lng == null) return null;
    const next = dayStops.slice(i + 1).find(s => s.lat != null && s.lng != null);
    if (!next) return null;
    const leg = legs[stop.id] ?? estimateLeg(stop.id, next.id, { lat: stop.lat, lng: stop.lng }, { lat: next.lat!, lng: next.lng! }, "WALKING");
    return { label: `${formatTravelTime(leg.seconds)} · ${formatDistance(leg.meters)}`, estimated: leg.estimated, flight: leg.kind === "flight" };
  }
  // Bias place search toward the day's stops (or the whole trip's) so results stay local.
  const searchBias = useMemo(() => {
    const pts = (dayStops.some(s => s.lat != null) ? dayStops : stops).filter(s => s.lat != null && s.lng != null);
    if (!pts.length) return null;
    return { lat: pts.reduce((a, s) => a + s.lat!, 0) / pts.length, lng: pts.reduce((a, s) => a + s.lng!, 0) / pts.length };
  }, [dayStops, stops]);
  const openAddPlace = canEdit ? (p: PlaceDraft) => setDialog({ open: true, editing: null, prefill: p }) : undefined;

  function refresh() {
    supabase.from("stops").select("*").eq("trip_id", trip.id).order("order_index")
      .then(({ data }) => { if (data) setStops(data); });
    supabase.from("itinerary_days").select("*").eq("trip_id", trip.id).order("day_number")
      .then(({ data }) => {
        if (!data) return;
        setDays(data);
        setSelectedDay(cur => cur && data.some((d: Day) => d.id === cur) ? cur : data[0]?.id ?? null);
      });
  }

  async function addDay() {
    setAddingDay(true);
    const nextNum = (days[days.length - 1]?.day_number ?? 0) + 1;
    const date = trip.start_date
      ? toISODate(new Date(parseDate(trip.start_date).getFullYear(), parseDate(trip.start_date).getMonth(), parseDate(trip.start_date).getDate() + nextNum - 1))
      : null;
    const { data, error } = await supabase.from("itinerary_days")
      .insert({ trip_id: trip.id, day_number: nextNum, date }).select().single();
    setAddingDay(false);
    if (error) { toast.error(t("itinerary.errors.addDay")); return; }
    setDays(d => [...d, data]);
    setSelectedDay(data.id);
  }

  async function removeDay() {
    if (!removingDay) return;
    const removedIndex = days.findIndex(d => d.id === removingDay.id);
    const { error } = await supabase.from("itinerary_days").delete()
      .eq("id", removingDay.id).eq("trip_id", trip.id);
    if (error) { toast.error(t("itinerary.errors.removeDay")); return; }

    const remaining = days.filter(d => d.id !== removingDay.id);
    const normalized = remaining.map((d, index) => ({
      ...d,
      day_number: index + 1,
      date: trip.start_date
        ? toISODate(new Date(parseDate(trip.start_date).getFullYear(), parseDate(trip.start_date).getMonth(), parseDate(trip.start_date).getDate() + index))
        : d.date,
    }));
    const updates = await Promise.all(normalized.map(d =>
      supabase.from("itinerary_days").update({ day_number: d.day_number, date: d.date }).eq("id", d.id)
    ));
    setDays(normalized);
    setStops(current => current.filter(stop => stop.day_id !== removingDay.id));
    setSelectedDay(current => current === removingDay.id
      ? normalized[Math.min(removedIndex, normalized.length - 1)]?.id ?? null
      : current);
    setRemovingDay(null);
    if (updates.some(result => result.error)) {
      toast.error(t("itinerary.errors.resequenceDays"));
      refresh();
      return;
    }
    toast.success(t("itinerary.dayRemoved"));
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = dayStops.findIndex(s => s.id === active.id);
    const to = dayStops.findIndex(s => s.id === over.id);
    const reordered = arrayMove(dayStops, from, to).map((s, i) => ({ ...s, order_index: i }));
    setStops(prev => [...prev.filter(s => s.day_id !== selectedDay), ...reordered]);
    const results = await Promise.all(reordered.map(s =>
      supabase.from("stops").update({ order_index: s.order_index }).eq("id", s.id)));
    if (results.some(r => r.error)) { toast.error(t("itinerary.errors.reorder")); refresh(); }
  }

  async function deleteStop(id: string) {
    const prev = stops;
    setStops(p => p.filter(s => s.id !== id));
    const { error } = await supabase.from("stops").delete().eq("id", id);
    if (error) { setStops(prev); toast.error(t("itinerary.errors.remove")); return; }
    toast.success(t("itinerary.removed"));
  }

  const dayTitle = day ? t("itinerary.day", { number: dayIndex + 1 }) : t("nav.itinerary");
  const daySubtitle = day?.date
    ? formatLongDate(day.date)
    : trip.title;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Planner column ───────────────────────────────────────── */}
      <section className="flex h-full w-full flex-col bg-paper lg:w-[440px] lg:shrink-0 lg:border-r lg:border-line"
               aria-label={t("itinerary.planner")}>
        <header className="px-5 pb-4 pt-6 sm:px-6">
          <p className="eyebrow">{t("nav.itinerary")} · {t("common.daysCount", { count: days.length })}</p>
          <h1 className="display mt-2 text-[34px] text-ink">{dayTitle}</h1>
          <p suppressHydrationWarning className="mt-0.5 text-[13px] text-ink-2">{daySubtitle}</p>
        </header>

        {/* Day strip */}
        <div className="border-b border-line">
          <DayStrip days={days} selected={selectedDay} onSelect={setSelectedDay}
                    onAdd={canEdit ? addDay : undefined}
                    onRemove={canEdit ? id => setRemovingDay(days.find(d => d.id === id) ?? null) : undefined}
                    adding={addingDay} className="px-5 pb-4 sm:px-6" />
        </div>

        {/* Stops */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-5 sm:px-6 lg:pb-5">
          {!selectedDay ? (
            <div className="grid-texture flex flex-col items-center rounded-[var(--radius-panel)] border border-line px-6 py-14 text-center">
              <CalendarPlus size={20} className="text-ink-3" aria-hidden="true" />
              <p className="mt-3 text-[15px] font-semibold text-ink">{t("itinerary.startTitle")}</p>
              <p className="mt-1 max-w-xs text-[13px] text-ink-2">{t("itinerary.startDesc")}</p>
              {canEdit && <Button className="mt-5" onClick={addDay} loading={addingDay}>{t("itinerary.addDayOne")}</Button>}
            </div>
          ) : (
            <>
              {dayStops.length > 0 ? (
                <DndContext id={`itinerary-${trip.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={dayStops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <ol>
                      {dayStops.map((stop, i) => (
                        <StopCard key={stop.id} stop={stop} index={i} readOnly={!canEdit}
                                  selected={selectedStop === stop.id}
                                  onSelect={id => setSelectedStop(cur => cur === id ? null : id)}
                                  legToNext={legLabel(stop, i)}
                                  onEdit={s => setDialog({ open: true, editing: s })} onDelete={deleteStop} />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <Route size={20} className="text-ink-3" aria-hidden="true" />
                  <p className="mt-3 text-[13px] text-ink-2">{t("itinerary.emptyDay")}</p>
                </div>
              )}

              {canEdit && (
                <button onClick={() => setDialog({ open: true, editing: null })}
                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-panel)] border border-dashed border-line-strong text-[13px] font-medium text-ink-2 transition-colors hover:border-ink hover:bg-surface hover:text-ink">
                  <Plus size={15} aria-hidden="true" /> {t("itinerary.addStop")}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Map (desktop) — only mounted on large screens ─────────── */}
      {isDesktop && (
        <div className="relative flex-1">
          <LazyTripMap stops={dayStops} selectedId={selectedStop} onSelect={setSelectedStop}
                       onLegs={setLegs} onAddPlace={selectedDay ? openAddPlace : undefined} />
        </div>
      )}

      {/* ── Map (mobile) ─────────────────────────────────────────── */}
      {!isDesktop && selectedDay && (
        <Button onClick={() => setMapOpen(true)}
                className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 h-11 rounded-full px-5 shadow-[0_10px_30px_-10px_rgb(22_24_29/0.5)] lg:hidden">
          <MapIcon size={16} aria-hidden="true" /> {t("itinerary.showMap")}
        </Button>
      )}
      {!isDesktop && mapOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-paper animate-sheet" role="dialog" aria-modal="true" aria-label={t("nav.map")}>
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <div>
              <p className="eyebrow">{dayTitle}</p>
              <p className="text-[13px] text-ink">{t("itinerary.stopsCount", { count: dayStops.length })}</p>
            </div>
            <Button variant="secondary" size="icon" onClick={() => setMapOpen(false)} aria-label={t("itinerary.hideMap")}>
              <X size={18} />
            </Button>
          </div>
          <div className="flex-1">
            <LazyTripMap stops={dayStops} selectedId={selectedStop} onSelect={setSelectedStop}
                         onLegs={setLegs} onAddPlace={openAddPlace} />
          </div>
        </div>
      )}

      {dialog.open && selectedDay && (
        <AddStopDialog open onClose={() => setDialog({ open: false, editing: null })}
                       tripId={trip.id} dayId={selectedDay} editingStop={dialog.editing} prefill={dialog.prefill}
                       near={searchBias}
                       nextOrder={dayStops.length} onSaved={refresh} />
      )}

      <ConfirmDialog open={!!removingDay} onClose={() => setRemovingDay(null)} onConfirm={removeDay}
                     title={t("itinerary.deleteDayTitle", { day: removingDay ? days.findIndex(d => d.id === removingDay.id) + 1 : "" })}
                     description={t("itinerary.deleteDayDescription")}
                     confirmLabel={t("itinerary.removeDay")} />
    </div>
  );
}
