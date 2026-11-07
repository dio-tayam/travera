"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Loader2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchPlaces, type LatLng, type PlaceResult } from "@/lib/maps";
import { STOP_META, STOP_TYPES } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Database } from "@/types/database";
import type { PlaceDraft } from "./trip-map";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface Props {
  open: boolean; onClose: () => void;
  tripId: string; dayId: string;
  editingStop?: Stop | null;
  /** A place picked on the map — pre-fills title, address and coordinates for a new stop. */
  prefill?: PlaceDraft | null;
  /** Bias place search toward this point (e.g. the day's other stops). */
  near?: LatLng | null;
  nextOrder: number; onSaved: () => void;
}

export function AddStopDialog({ open, onClose, tripId, dayId, editingStop, prefill, near, nextOrder, onSaved }: Props) {
  const { t } = useTranslation("common");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<Stop>>(editingStop ?? {
    title: prefill && !prefill.placeholder ? prefill.title : "",
    type: "activity", address: prefill?.address ?? null, lat: prefill?.lat ?? null, lng: prefill?.lng ?? null,
    place_id: prefill?.placeId ?? null, start_time: null, duration_minutes: null, notes: null,
  });

  // Free place search (Photon / OpenStreetMap), debounced and cancellable.
  const [search, setSearch] = useState(editingStop?.address ?? prefill?.address ?? "");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const q = search.trim();
    if (!searchEnabled || q.length < 3) { setResults([]); setSearching(false); setHasSearched(false); return; }
    const ctrl = new AbortController();
    setHasSearched(false);
    const id = setTimeout(() => {
      setSearching(true);
      searchPlaces(q, near, ctrl.signal)
        .then(r => { setResults(r); setActive(-1); setHasSearched(true); })
        .catch(() => { if (!ctrl.signal.aborted) { setResults([]); setHasSearched(true); } })
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [search, near, searchEnabled]);

  function selectPlace(p: PlaceResult) {
    setSearchEnabled(false);
    setSearch(p.address);
    setResults([]);
    setSearching(false);
    setHasSearched(false);
    setForm(f => ({ ...f, title: f.title?.trim() ? f.title : p.title, address: p.address, lat: p.lat, lng: p.lng, place_id: p.placeId }));
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => (a + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => (a <= 0 ? results.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); selectPlace(results[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); setResults([]); setHasSearched(false); }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title?.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const payload = {
      title: form.title.trim(), type: (form.type as Stop["type"]) ?? "activity",
      address: form.address ?? null, lat: form.lat ?? null, lng: form.lng ?? null,
      place_id: form.place_id ?? null, start_time: form.start_time ?? null,
      duration_minutes: form.duration_minutes ?? null, notes: form.notes ?? null,
    };
    const { error } = editingStop
      ? await supabase.from("stops").update(payload).eq("id", editingStop.id)
      : await supabase.from("stops").insert({ ...payload, trip_id: tripId, day_id: dayId, order_index: nextOrder });
    setLoading(false);
    if (error) { toast.error(t("itinerary.errors.save")); return; }
    toast.success(editingStop ? t("itinerary.updated") : t("itinerary.added"));
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }}
           title={editingStop ? t("itinerary.editStop") : t("itinerary.addStop")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t("itinerary.stopTitle")} htmlFor="stop-title">
          <Input id="stop-title" required autoFocus value={form.title ?? ""}
                 onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t("itinerary.titlePlaceholder")} maxLength={160} />
        </Field>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("itinerary.type")}</legend>
          <div className="grid grid-cols-3 gap-1.5">
            {STOP_TYPES.map(type => {
              const { icon: Icon, color } = STOP_META[type];
              const active = form.type === type;
              return (
                <button key={type} type="button" aria-pressed={active}
                        onClick={() => setForm(f => ({ ...f, type }))}
                        className={cn(
                          "flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border text-[12.5px] transition-colors",
                          active ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:bg-sunken"
                        )}>
                  <Icon size={14} style={active ? undefined : { color }} aria-hidden="true" />
                  <span className="truncate">{t(`itinerary.stopTypes.${type}`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label={t("itinerary.address")} htmlFor="stop-address" optional
               hint={form.lat != null ? undefined : t("itinerary.addressHint")}>
          <div className="relative">
            <MapPin size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input id="stop-address" value={search} autoComplete="off" role="combobox"
                   aria-expanded={results.length > 0 || (hasSearched && !searching)} aria-controls="stop-address-results"
                   aria-activedescendant={active >= 0 ? `place-${active}` : undefined}
                   placeholder={t("itinerary.searchPlace")} className="ps-9 pe-9"
                   onKeyDown={onSearchKey}
                   onChange={e => {
                     setSearchEnabled(true);
                     setHasSearched(false);
                     setResults([]);
                     setSearching(e.target.value.trim().length >= 3);
                     setSearch(e.target.value);
                     setForm(f => ({ ...f, address: e.target.value || null, lat: null, lng: null, place_id: null }));
                   }} />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2">
              {searching ? <Loader2 size={15} className="animate-spin text-ink-3" />
                : form.lat != null ? <Check size={15} className="text-positive" aria-label={t("itinerary.pinned")} /> : null}
            </span>
            {(results.length > 0 || (hasSearched && !searching)) && (
              <ul id="stop-address-results" role="listbox"
                  className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)]">
                {results.length > 0 ? <>
                  {results.map((p, i) => (
                    <li key={`${p.placeId ?? ""}-${i}`} id={`place-${i}`} role="option" aria-selected={active === i}>
                      <button type="button" onClick={() => selectPlace(p)} onMouseEnter={() => setActive(i)}
                              className={cn("flex w-full items-start gap-2.5 rounded-[8px] px-3 py-2 text-start", active === i && "bg-sunken")}>
                        <MapPin size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">{p.title}</span>
                          {p.subtitle && <span className="block truncate text-[12px] text-ink-3">{p.subtitle}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li className="px-3 pb-1 pt-1.5 text-[10.5px] text-ink-3">{t("itinerary.attribution")}</li>
                </> : <li className="px-3 py-2 text-[12px] text-ink-3">{t("common.noResults")}</li>}
              </ul>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("itinerary.startTime")} htmlFor="stop-time" optional>
            <Input id="stop-time" type="time" value={form.start_time?.slice(0, 5) ?? ""}
                   onChange={e => setForm(f => ({ ...f, start_time: e.target.value || null }))} />
          </Field>
          <Field label={t("itinerary.duration")} htmlFor="stop-duration" optional>
            <Input id="stop-duration" type="number" inputMode="numeric" min="1" placeholder="60"
                   value={form.duration_minutes ?? ""}
                   onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value ? parseInt(e.target.value) : null }))} />
          </Field>
        </div>

        <Field label={t("itinerary.notes")} htmlFor="stop-notes" optional>
          <Textarea id="stop-notes" rows={3} value={form.notes ?? ""}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                    placeholder={t("itinerary.notesPlaceholder")} maxLength={2000} />
        </Field>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" loading={loading}>{t("common.save")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
