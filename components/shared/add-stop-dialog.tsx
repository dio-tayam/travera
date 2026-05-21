"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { TraveraSpinner } from "./travera-spinner";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

const STOP_TYPES = ["hotel", "activity", "restaurant", "transit", "flight", "free"] as const;

interface AddStopDialogProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  dayId: string;
  editingStop?: Stop | null;
  nextOrder: number;
  onSaved: () => void;
}

export function AddStopDialog({
  open,
  onClose,
  tripId,
  dayId,
  editingStop,
  nextOrder,
  onSaved,
}: AddStopDialogProps) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Stop>>(
    editingStop ?? {
      title: "",
      type: "activity",
      address: null,
      lat: null,
      lng: null,
      place_id: null,
      start_time: null,
      duration_minutes: null,
      notes: null,
    }
  );

  const {
    ready,
    value: searchValue,
    suggestions: { status, data },
    setValue: setSearchValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    requestOptions: { types: ["establishment", "geocode"] },
  });

  const handleSelectPlace = useCallback(
    async (description: string, placeId: string) => {
      setSearchValue(description, false);
      clearSuggestions();
      try {
        const results = await getGeocode({ address: description });
        const { lat, lng } = await getLatLng(results[0]);
        setForm((f) => ({
          ...f,
          address: description,
          lat,
          lng,
          place_id: placeId,
        }));
      } catch {}
    },
    [setSearchValue, clearSuggestions]
  );

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title) return;
    setLoading(true);
    try {
      if (editingStop) {
        const { error } = await supabase
          .from("stops")
          .update({
            title: form.title!,
            type: form.type as Stop["type"],
            address: form.address,
            lat: form.lat,
            lng: form.lng,
            place_id: form.place_id,
            start_time: form.start_time,
            duration_minutes: form.duration_minutes,
            notes: form.notes,
          })
          .eq("id", editingStop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stops").insert({
          trip_id: tripId,
          day_id: dayId,
          order_index: nextOrder,
          title: form.title!,
          type: (form.type as Stop["type"]) ?? "activity",
          address: form.address ?? null,
          lat: form.lat ?? null,
          lng: form.lng ?? null,
          place_id: form.place_id ?? null,
          start_time: form.start_time ?? null,
          duration_minutes: form.duration_minutes ?? null,
          notes: form.notes ?? null,
        });
        if (error) throw error;
      }
      toast.success(editingStop ? "Stop updated!" : "Stop added!");
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save stop");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stop-dialog-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2
            id="stop-dialog-title"
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {editingStop ? t("itinerary.editStop") : t("itinerary.addStop")}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              {t("itinerary.stopTitle")} *
            </label>
            <input
              type="text"
              required
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
              style={{ fontFamily: "var(--font-body)" }}
              placeholder="Hotel Okura"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {STOP_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                  style={
                    form.type === type
                      ? { backgroundColor: "var(--color-primary)", color: "white", borderColor: "var(--color-primary)" }
                      : { borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }
                  }
                >
                  {t(`itinerary.stopTypes.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Places autocomplete */}
          <div className="space-y-1 relative">
            <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              {t("itinerary.address")}
            </label>
            <input
              type="text"
              value={searchValue || form.address || ""}
              onChange={(e) => setSearchValue(e.target.value)}
              disabled={!ready}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
              style={{ fontFamily: "var(--font-body)" }}
              placeholder="Search for a place..."
            />
            {status === "OK" && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-20 max-h-48 overflow-y-auto">
                {data.map(({ place_id, description }) => (
                  <li key={place_id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPlace(description, place_id)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors"
                      style={{ fontFamily: "var(--font-body)", color: "var(--color-foreground)" }}
                    >
                      {description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
                {t("itinerary.startTime")}
              </label>
              <input
                type="time"
                value={form.start_time ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value || null }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
                {t("itinerary.duration")}
              </label>
              <input
                type="number"
                min="1"
                value={form.duration_minutes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
                placeholder="60"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              {t("itinerary.notes")}
            </label>
            <textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
            >
              {loading && <TraveraSpinner size={16} />}
              {t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
