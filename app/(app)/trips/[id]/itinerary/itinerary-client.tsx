"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
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
import { parseDate } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { StopCard } from "@/components/shared/stop-card";
import { DayStrip } from "@/components/shared/day-strip";
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const ch = supabase.channel(`stops:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stops", filter: `trip_id=eq.${trip.id}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }

  async function addDay() {
    setAddingDay(true);
    const nextNum = (days[days.length - 1]?.day_number ?? 0) + 1;
    const date = trip.start_date
      ? new Date(new Date(trip.start_date).getTime() + (nextNum - 1) * 86_400_000).toISOString().split("T")[0]
      : null;
    const { data, error } = await supabase.from("itinerary_days")
      .insert({ trip_id: trip.id, day_number: nextNum, date }).select().single();
    setAddingDay(false);
    if (error) { toast.error("Couldn't add a day"); return; }
    setDays(d => [...d, data]);
    setSelectedDay(data.id);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = dayStops.findIndex(s => s.id === active.id);
    const to = dayStops.findIndex(s => s.id === over.id);
    const reordered = arrayMove(dayStops, from, to).map((s, i) => ({ ...s, order_index: i }));
    setStops(prev => [...prev.filter(s => s.day_id !== selectedDay), ...reordered]);
    const results = await Promise.all(reordered.map(s =>
      supabase.from("stops").update({ order_index: s.order_index }).eq("id", s.id)));
    if (results.some(r => r.error)) { toast.error("Couldn't save the new order"); refresh(); }
  }

  async function deleteStop(id: string) {
    const prev = stops;
    setStops(p => p.filter(s => s.id !== id));
    const { error } = await supabase.from("stops").delete().eq("id", id);
    if (error) { setStops(prev); toast.error("Couldn't remove the stop"); return; }
    toast.success("Stop removed");
  }

  const dayTitle = day ? `Day ${dayIndex + 1}` : "Itinerary";
  const daySubtitle = day?.date
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(parseDate(day.date))
    : trip.title;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Planner column ───────────────────────────────────────── */}
      <section className="flex h-full w-full flex-col bg-paper lg:w-[440px] lg:shrink-0 lg:border-r lg:border-line"
               aria-label="Day planner">
        <header className="px-5 pb-4 pt-6 sm:px-6">
          <p className="eyebrow">{t("nav.itinerary")} · {days.length} {days.length === 1 ? "day" : "days"}</p>
          <h1 className="display mt-2 text-[34px] text-ink">{dayTitle}</h1>
          <p className="mt-0.5 text-[13px] text-ink-2">{daySubtitle}</p>
        </header>

        {/* Day strip */}
        <div className="border-b border-line">
          <DayStrip days={days} selected={selectedDay} onSelect={setSelectedDay}
                    onAdd={canEdit ? addDay : undefined} adding={addingDay} className="px-5 pb-4 sm:px-6" />
        </div>

        {/* Stops */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 pt-5 sm:px-6 lg:pb-5">
          {!selectedDay ? (
            <div className="grid-texture flex flex-col items-center rounded-[var(--radius-panel)] border border-line px-6 py-14 text-center">
              <CalendarPlus size={20} className="text-ink-3" aria-hidden="true" />
              <p className="mt-3 text-[15px] font-semibold text-ink">Start with day one</p>
              <p className="mt-1 max-w-xs text-[13px] text-ink-2">Add a day, then fill it with places to go, eat and stay.</p>
              {canEdit && <Button className="mt-5" onClick={addDay} loading={addingDay}>Add day 1</Button>}
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
                  <p className="mt-3 text-[13px] text-ink-2">Nothing planned for this day yet.</p>
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
        <div className="fixed inset-0 z-40 flex flex-col bg-paper animate-sheet" role="dialog" aria-modal="true" aria-label="Map">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <div>
              <p className="eyebrow">{dayTitle}</p>
              <p className="text-[13px] text-ink">{dayStops.length} {dayStops.length === 1 ? "stop" : "stops"}</p>
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
    </div>
  );
}
