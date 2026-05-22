"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { StopCard } from "@/components/shared/stop-card";
import { AddStopDialog } from "@/components/shared/add-stop-dialog";
import { TripMap } from "@/components/shared/trip-map";
import { Plus, Map, X, Plane } from "lucide-react";
import { toast } from "sonner";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day  = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface Props {
  trip: Trip; initialDays: Day[]; initialStops: Stop[];
  userId: string; canEdit: boolean;
}

export function ItineraryClient({ trip, initialDays, initialStops, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();

  const [days, setDays]       = useState<Day[]>(initialDays);
  const [stops, setStops]     = useState<Stop[]>(initialStops);
  const [selectedDay, setDay] = useState<string | null>(initialDays[0]?.id ?? null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Stop | null>(null);
  const [showMap, setShowMap] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const ch = supabase.channel(`stops:${trip.id}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"stops",
           filter:`trip_id=eq.${trip.id}` }, () => {
        supabase.from("stops").select("*").eq("trip_id", trip.id)
          .order("order_index").then(({ data }) => { if (data) setStops(data); });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayStops = stops.filter(s => s.day_id === selectedDay)
    .sort((a, b) => a.order_index - b.order_index);
  const mapStops = stops.filter(s => s.lat && s.lng);

  async function addDay() {
    const nextNum = (days[days.length - 1]?.day_number ?? 0) + 1;
    const date = trip.start_date
      ? new Date(new Date(trip.start_date).getTime() + (nextNum - 1) * 86400000)
          .toISOString().split("T")[0]
      : null;
    const { data, error } = await supabase.from("itinerary_days")
      .insert({ trip_id: trip.id, day_number: nextNum, date }).select().single();
    if (error) { toast.error("Failed to add day"); return; }
    setDays(d => [...d, data]);
    setDay(data.id);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIdx = dayStops.findIndex(s => s.id === active.id);
    const newIdx = dayStops.findIndex(s => s.id === over.id);
    const reordered = arrayMove(dayStops, oldIdx, newIdx).map((s, i) => ({ ...s, order_index: i }));
    setStops(prev => [...prev.filter(s => s.day_id !== selectedDay), ...reordered]);
    await Promise.all(reordered.map(s =>
      supabase.from("stops").update({ order_index: s.order_index }).eq("id", s.id)
    ));
  }

  async function deleteStop(id: string) {
    await supabase.from("stops").delete().eq("id", id);
    setStops(prev => prev.filter(s => s.id !== id));
    toast.success("Stop removed");
  }

  function refresh() {
    supabase.from("stops").select("*").eq("trip_id", trip.id).order("order_index")
      .then(({ data }) => { if (data) setStops(data); });
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left panel ──────────────────────────────────────────────── */}
      <div className="w-full lg:w-96 shrink-0 flex flex-col h-full bg-white
                      border-r border-slate-100 overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-slate-100">
          <h1 className="font-bold text-slate-900 text-base"
              style={{ fontFamily: "var(--font-heading)" }}>{trip.title}</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Day-by-day planner</p>
        </div>

        {/* Day pills */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {days.map((day, idx) => (
              <button key={day.id} onClick={() => setDay(day.id)}
                      className="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold
                                 transition-all whitespace-nowrap"
                      style={selectedDay === day.id
                        ? { background: "var(--color-itinerary)", color: "white",
                            boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }
                        : { background: "#f1f5f9", color: "#64748b" }}>
                Day {idx + 1}
                {day.date && (
                  <span className="block text-[10px] font-normal opacity-75 mt-0.5">
                    {new Date(day.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </span>
                )}
              </button>
            ))}
            {canEdit && (
              <button onClick={addDay}
                      className="shrink-0 px-3 py-2 rounded-full text-xs font-semibold
                                 border-2 border-dashed border-slate-200 text-slate-400
                                 hover:border-indigo-300 hover:text-indigo-500 transition-colors
                                 whitespace-nowrap">
                + Day
              </button>
            )}
          </div>
        </div>

        {/* Stops list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {selectedDay ? (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}>
                <SortableContext items={dayStops.map(s => s.id)}
                                 strategy={verticalListSortingStrategy}>
                  {dayStops.map((stop, idx) => (
                    <StopCard key={stop.id} stop={stop} index={idx}
                              onEdit={s => { setEditing(s); setShowAdd(true); }}
                              onDelete={deleteStop} readOnly={!canEdit}/>
                  ))}
                </SortableContext>
              </DndContext>

              {dayStops.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Plane size={36} className="text-slate-200 -rotate-45 mb-3" aria-hidden="true"/>
                  <p className="text-sm text-slate-400">No stops yet. Add your first stop!</p>
                </div>
              )}

              {canEdit && (
                <button onClick={() => { setEditing(null); setShowAdd(true); }}
                        className="w-full flex items-center justify-center gap-2 py-3
                                   rounded-2xl border-2 border-dashed border-slate-200
                                   text-sm font-medium text-slate-400
                                   hover:border-indigo-300 hover:text-indigo-500 transition-colors">
                  <Plus size={14}/> {t("itinerary.addStop")}
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Plane size={40} className="text-slate-200 -rotate-45 mb-4" aria-hidden="true"/>
              <p className="text-sm text-slate-400 mb-4">Add your first day to start planning.</p>
              {canEdit && (
                <button onClick={addDay}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-white
                                   itinerary-gradient hover:opacity-90 transition-all active:scale-95">
                  Add Day 1
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mobile map toggle */}
        <div className="lg:hidden px-4 py-3 border-t border-slate-100">
          <button onClick={() => setShowMap(s => !s)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                             text-sm font-medium border border-slate-200 text-slate-600
                             hover:bg-slate-50 transition-colors active:scale-95">
            <Map size={14}/> {showMap ? t("itinerary.hideMap") : t("itinerary.showMap")}
          </button>
        </div>
      </div>

      {/* ── Map (desktop) ────────────────────────────────────────────── */}
      <div className="hidden lg:block flex-1 h-full">
        <TripMap stops={mapStops}/>
      </div>

      {/* ── Map sheet (mobile) ───────────────────────────────────────── */}
      {showMap && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col animate-slide-up">
          <div className="flex-1 relative">
            <TripMap stops={mapStops}/>
            <button onClick={() => setShowMap(false)}
                    className="absolute top-4 right-4 w-9 h-9 bg-white rounded-full
                               shadow-lg flex items-center justify-center text-slate-600
                               hover:bg-slate-50 transition-colors"
                    aria-label="Close map">
              <X size={18}/>
            </button>
          </div>
        </div>
      )}

      {showAdd && selectedDay && (
        <AddStopDialog open={showAdd}
          onClose={() => { setShowAdd(false); setEditing(null); }}
          tripId={trip.id} dayId={selectedDay}
          editingStop={editing} nextOrder={dayStops.length}
          onSaved={refresh}/>
      )}
    </div>
  );
}
