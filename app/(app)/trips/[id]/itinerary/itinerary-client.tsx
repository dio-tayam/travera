"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { StopCard } from "@/components/shared/stop-card";
import { AddStopDialog } from "@/components/shared/add-stop-dialog";
import { TripMap } from "@/components/shared/trip-map";
import { Plus, Map, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];
type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface ItineraryClientProps {
  trip: Trip;
  initialDays: Day[];
  initialStops: Stop[];
  userId: string;
  canEdit: boolean;
}

export function ItineraryClient({
  trip,
  initialDays,
  initialStops,
  canEdit,
}: ItineraryClientProps) {
  const { t } = useTranslation("common");
  const supabase = createClient();

  const [days, setDays] = useState<Day[]>(initialDays);
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(
    initialDays[0]?.id ?? null
  );
  const [showAdd, setShowAdd] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [showMap, setShowMap] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Realtime subscription for stops
  useEffect(() => {
    const channel = supabase
      .channel(`stops:trip:${trip.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stops",
          filter: `trip_id=eq.${trip.id}`,
        },
        () => {
          supabase
            .from("stops")
            .select("*")
            .eq("trip_id", trip.id)
            .order("order_index")
            .then(({ data }) => { if (data) setStops(data); });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [trip.id, supabase]);

  const dayStops = stops.filter((s) => s.day_id === selectedDayId);
  const allStops = stops.filter((s) => s.lat && s.lng);

  async function addDay() {
    const nextNumber = (days[days.length - 1]?.day_number ?? 0) + 1;
    const tripStart = trip.start_date ? new Date(trip.start_date) : null;
    const date = tripStart
      ? new Date(tripStart.getTime() + (nextNumber - 1) * 86400000).toISOString().split("T")[0]
      : null;

    const { data, error } = await supabase
      .from("itinerary_days")
      .insert({ trip_id: trip.id, day_number: nextNumber, date })
      .select()
      .single();

    if (error) { toast.error("Failed to add day"); return; }
    setDays((d) => [...d, data]);
    setSelectedDayId(data.id);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = dayStops.findIndex((s) => s.id === active.id);
    const newIndex = dayStops.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(dayStops, oldIndex, newIndex);

    const updates = reordered.map((s, i) => ({ ...s, order_index: i }));
    setStops((prev) => [
      ...prev.filter((s) => s.day_id !== selectedDayId),
      ...updates,
    ]);

    // Batch update order_index values in Supabase
    await Promise.all(
      updates.map((s) =>
        supabase
          .from("stops")
          .update({ order_index: s.order_index })
          .eq("id", s.id)
      )
    );
  }

  async function handleDeleteStop(stopId: string) {
    await supabase.from("stops").delete().eq("id", stopId);
    setStops((prev) => prev.filter((s) => s.id !== stopId));
    toast.success("Stop deleted");
  }

  function refreshStops() {
    supabase
      .from("stops")
      .select("*")
      .eq("trip_id", trip.id)
      .order("order_index")
      .then(({ data }) => { if (data) setStops(data); });
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-full lg:w-[420px] lg:flex-shrink-0 flex flex-col h-full overflow-hidden border-r border-gray-100 bg-white">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <h1
            className="text-lg font-bold"
            style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}
          >
            {trip.title}
          </h1>
          <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
            {t("nav.itinerary")}
          </p>
        </div>

        {/* Day selector */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {days.map((day, idx) => (
              <button
                key={day.id}
                onClick={() => setSelectedDayId(day.id)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={
                  selectedDayId === day.id
                    ? { backgroundColor: "var(--color-gold)", color: "var(--color-primary)" }
                    : { backgroundColor: "#f1f5f9", color: "#64748b" }
                }
              >
                {t("itinerary.day", { number: idx + 1 })}
                {day.date && (
                  <span className="block text-xs font-normal">
                    {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </button>
            ))}
            {canEdit && (
              <button
                onClick={addDay}
                className="flex-shrink-0 px-3 py-2 rounded-full text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-400 hover:border-gray-300 transition-colors"
              >
                + Day
              </button>
            )}
          </div>
        </div>

        {/* Stops list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedDayId ? (
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={dayStops.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {dayStops.map((stop, idx) => (
                    <StopCard
                      key={stop.id}
                      stop={stop}
                      index={idx}
                      onEdit={(s) => { setEditingStop(s); setShowAdd(true); }}
                      onDelete={handleDeleteStop}
                      readOnly={!canEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {dayStops.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                    No stops for this day yet.
                  </p>
                </div>
              )}

              {canEdit && (
                <button
                  onClick={() => { setEditingStop(null); setShowAdd(true); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <Plus size={16} aria-hidden="true" />
                  {t("itinerary.addStop")}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                Add a day to start planning.
              </p>
              {canEdit && (
                <button
                  onClick={addDay}
                  className="mt-3 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
                >
                  Add Day 1
                </button>
              )}
            </div>
          )}
        </div>

        {/* Mobile map toggle */}
        <div className="lg:hidden px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setShowMap((s) => !s)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <Map size={16} aria-hidden="true" />
            {showMap ? t("itinerary.hideMap") : t("itinerary.showMap")}
          </button>
        </div>
      </div>

      {/* Map — desktop always visible, mobile as overlay */}
      <div className="hidden lg:block flex-1 h-full">
        <TripMap stops={allStops} />
      </div>

      {/* Mobile map sheet */}
      {showMap && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col animate-slide-up">
          <div className="flex-1 relative">
            <TripMap stops={allStops} />
            <button
              onClick={() => setShowMap(false)}
              className="absolute top-4 right-4 bg-white rounded-full shadow-md p-2"
              aria-label="Close map"
            >
              <ChevronUp size={20} style={{ color: "var(--color-primary)" }} />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit stop dialog */}
      {showAdd && selectedDayId && (
        <AddStopDialog
          open={showAdd}
          onClose={() => { setShowAdd(false); setEditingStop(null); }}
          tripId={trip.id}
          dayId={selectedDayId}
          editingStop={editingStop}
          nextOrder={dayStops.length}
          onSaved={refreshStops}
        />
      )}
    </div>
  );
}
