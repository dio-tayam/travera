"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { X, Plane, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/types/database";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

const STOP_TYPES = ["hotel","activity","restaurant","transit","flight","free"] as const;
const TYPE_EMOJI: Record<string,string> = {
  hotel:"🏨", activity:"🎯", restaurant:"🍜",
  transit:"🚌", flight:"✈️", free:"🌿",
};

interface Props {
  open: boolean; onClose: () => void;
  tripId: string; dayId: string;
  editingStop?: Stop | null;
  nextOrder: number; onSaved: () => void;
}

export function AddStopDialog({ open, onClose, tripId, dayId, editingStop, nextOrder, onSaved }: Props) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Stop>>(editingStop ?? {
    title: "", type: "activity", address: null, lat: null, lng: null,
    place_id: null, start_time: null, duration_minutes: null, notes: null,
  });

  const {
    ready, value: searchVal,
    suggestions: { status, data },
    setValue: setSearch, clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 300, requestOptions: { types: ["establishment","geocode"] } });

  const selectPlace = useCallback(async (desc: string, placeId: string) => {
    setSearch(desc, false);
    clearSuggestions();
    try {
      const results = await getGeocode({ address: desc });
      const { lat, lng } = getLatLng(results[0]);
      setForm(f => ({ ...f, address: desc, lat, lng, place_id: placeId }));
    } catch { /* geocode failed silently */ }
  }, [setSearch, clearSuggestions]);

  if (!open) return null;

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title) return;
    setLoading(true);
    try {
      if (editingStop) {
        const { error } = await supabase.from("stops").update({
          title: form.title!, type: form.type as Stop["type"],
          address: form.address, lat: form.lat, lng: form.lng, place_id: form.place_id,
          start_time: form.start_time, duration_minutes: form.duration_minutes, notes: form.notes,
        }).eq("id", editingStop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stops").insert({
          trip_id: tripId, day_id: dayId, order_index: nextOrder,
          title: form.title!, type: (form.type as Stop["type"]) ?? "activity",
          address: form.address ?? null, lat: form.lat ?? null, lng: form.lng ?? null,
          place_id: form.place_id ?? null, start_time: form.start_time ?? null,
          duration_minutes: form.duration_minutes ?? null, notes: form.notes ?? null,
        });
        if (error) throw error;
      }
      toast.success(editingStop ? "Stop updated!" : "Stop added! ✈️");
      onSaved(); onClose();
    } catch { toast.error("Failed to save stop"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                    p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
         role="dialog" aria-modal="true" aria-labelledby="stop-dialog-title">
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl
                      max-h-[90dvh] overflow-y-auto animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl itinerary-gradient flex items-center justify-center">
              <Plane size={15} className="text-white -rotate-45"/>
            </div>
            <h2 id="stop-dialog-title" className="text-base font-bold text-slate-900"
                style={{ fontFamily:"var(--font-heading)" }}>
              {editingStop ? t("itinerary.editStop") : t("itinerary.addStop")}
            </h2>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label={t("common.close")}>
            <X size={17}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700"
                   style={{ fontFamily:"var(--font-body)" }}>
              {t("itinerary.stopTitle")} *
            </label>
            <input type="text" required value={form.title ?? ""}
                   onChange={e => setForm(f=>({...f,title:e.target.value}))}
                   placeholder="Senso-ji Temple"
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   style={{ fontFamily:"var(--font-body)" }}/>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700"
                   style={{ fontFamily:"var(--font-body)" }}>Type</label>
            <div className="flex flex-wrap gap-2">
              {STOP_TYPES.map(type => (
                <button key={type} type="button"
                        onClick={() => setForm(f=>({...f,type}))}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                                   font-semibold border transition-all"
                        style={form.type===type
                          ? { background:"var(--color-itinerary)", color:"white", borderColor:"var(--color-itinerary)" }
                          : { borderColor:"#e2e8f0", color:"#64748b", background:"white" }}>
                  {TYPE_EMOJI[type]} {t(`itinerary.stopTypes.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Address autocomplete */}
          <div className="space-y-1.5 relative">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"
                   style={{ fontFamily:"var(--font-body)" }}>
              <MapPin size={13} className="text-blue-400"/> {t("itinerary.address")}
            </label>
            <input type="text" disabled={!ready}
                   value={searchVal || form.address || ""}
                   onChange={e => setSearch(e.target.value)}
                   placeholder="Search for a place…"
                   className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   style={{ fontFamily:"var(--font-body)" }}/>
            {status === "OK" && (
              <ul className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl
                             border border-slate-100 z-20 max-h-48 overflow-y-auto">
                {data.map(({ place_id, description }) => (
                  <li key={place_id}>
                    <button type="button" onClick={() => selectPlace(description, place_id)}
                            className="w-full text-left px-4 py-3 text-sm text-slate-700
                                       hover:bg-blue-50 hover:text-blue-700 transition-colors"
                            style={{ fontFamily:"var(--font-body)" }}>
                      {description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Time + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-1"
                     style={{ fontFamily:"var(--font-body)" }}>
                <Clock size={12} className="text-blue-400"/> {t("itinerary.startTime")}
              </label>
              <input type="time" value={form.start_time ?? ""}
                     onChange={e => setForm(f=>({...f,start_time:e.target.value||null}))}
                     className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500"
                     style={{ fontFamily:"var(--font-body)" }}/>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700"
                     style={{ fontFamily:"var(--font-body)" }}>
                {t("itinerary.duration")}
              </label>
              <input type="number" min="1" placeholder="60"
                     value={form.duration_minutes ?? ""}
                     onChange={e => setForm(f=>({...f,duration_minutes:e.target.value?parseInt(e.target.value):null}))}
                     className="w-full px-3 py-3 rounded-xl border border-slate-200 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500"
                     style={{ fontFamily:"var(--font-body)" }}/>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700"
                   style={{ fontFamily:"var(--font-body)" }}>{t("itinerary.notes")}</label>
            <textarea rows={3} value={form.notes ?? ""}
                      onChange={e => setForm(f=>({...f,notes:e.target.value||null}))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      style={{ fontFamily:"var(--font-body)" }}/>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    style={{ fontFamily:"var(--font-body)" }}>
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                               rounded-xl text-sm font-semibold text-white itinerary-gradient
                               disabled:opacity-60 hover:opacity-90 transition-all active:scale-95">
              {loading && <Plane size={14} className="animate-plane-fly -rotate-45"/>}
              {loading ? "Saving…" : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
