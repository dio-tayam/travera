"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { generateShareToken } from "@/lib/utils";
import { X, Plane, MapPin, Calendar, Wallet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onClose: () => void; userId: string }

const CURRENCIES = ["PHP","USD","EUR","JPY","KRW","GBP","AUD","SGD","THB","CNY"];

const INPUT_CLS = `w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white
                   transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500
                   focus:border-transparent placeholder:text-slate-400`;

export function CreateTripDialog({ open, onClose, userId }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", destination: "",
    start_date: "", end_date: "",
    total_budget: "", currency: "PHP",
  });

  if (!open) return null;

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Trip title is required."); return; }
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").upsert({
          id: userId,
          display_name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Traveler",
          avatar_url: user.user_metadata?.avatar_url ?? null,
          home_currency: "PHP",
        }, { onConflict: "id" });
      }

      const { data: trip, error: tripErr } = await supabase
        .from("trips")
        .insert({
          owner_id: userId,
          title: form.title.trim(),
          destination: form.destination.trim() || null,
          start_date: form.start_date || null,
          end_date:   form.end_date   || null,
          total_budget: form.total_budget ? parseFloat(form.total_budget) : null,
          currency: form.currency,
          is_public: false,
          share_token: generateShareToken(),
        })
        .select()
        .single();

      if (tripErr) throw new Error(tripErr.message);

      const { error: memberErr } = await supabase
        .from("trip_members")
        .insert({ trip_id: trip.id, user_id: userId, role: "owner" });

      if (memberErr) throw new Error(memberErr.message);

      toast.success("Trip created! 🛫");
      onClose();
      setForm({ title:"",destination:"",start_date:"",end_date:"",total_budget:"",currency:"PHP" });
      router.push(`/trips/${trip.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create trip";
      setError(msg);
      toast.error("Could not create trip");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                    p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
         role="dialog" aria-modal="true" aria-labelledby="create-trip-title"
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl
                      shadow-2xl overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl sky-gradient flex items-center justify-center
                            shadow-sm shadow-blue-200">
              <Plane size={16} className="text-white -rotate-45" aria-hidden="true"/>
            </div>
            <div>
              <h2 id="create-trip-title" className="text-base font-bold text-slate-900"
                  style={{ fontFamily: "var(--font-heading)" }}>
                {t("trip.createTrip")}
              </h2>
              <p className="text-xs text-slate-400 font-medium">Fill in the details below</p>
            </div>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100
                             hover:text-slate-600 transition-colors"
                  aria-label={t("common.close")}>
            <X size={17}/>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 flex gap-2 items-start bg-red-50 border border-red-200
                          rounded-xl p-3 text-sm text-red-700" role="alert">
            <AlertCircle size={15} className="mt-0.5 shrink-0"/>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="ct-title" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Trip Name <span className="text-red-400">*</span>
            </label>
            <input id="ct-title" type="text" required
                   value={form.title}
                   onChange={e => set("title", e.target.value)}
                   placeholder="Summer in Tokyo"
                   className={INPUT_CLS}/>
          </div>

          {/* Destination */}
          <div className="space-y-1.5">
            <label htmlFor="ct-dest" className="text-xs font-semibold text-slate-600 uppercase tracking-wide
                                                 flex items-center gap-1.5">
              <MapPin size={11} className="text-blue-400"/> Destination
              <span className="text-slate-400 font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input id="ct-dest" type="text"
                   value={form.destination}
                   onChange={e => set("destination", e.target.value)}
                   placeholder="Tokyo, Japan"
                   className={INPUT_CLS}/>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { id:"ct-start", label:"Departure", key:"start_date" as const },
              { id:"ct-end",   label:"Return",    key:"end_date"   as const },
            ].map(({ id, label, key }) => (
              <div key={key} className="space-y-1.5">
                <label htmlFor={id}
                       className="text-xs font-semibold text-slate-600 uppercase tracking-wide
                                  flex items-center gap-1">
                  <Calendar size={11} className="text-blue-400"/> {label}
                </label>
                <input id={id} type="date"
                       value={form[key]}
                       onChange={e => set(key, e.target.value)}
                       className={INPUT_CLS}/>
              </div>
            ))}
          </div>

          {/* Budget + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ct-budget"
                     className="text-xs font-semibold text-slate-600 uppercase tracking-wide
                                flex items-center gap-1">
                <Wallet size={11} className="text-amber-400"/> Budget
              </label>
              <input id="ct-budget" type="number" min="0" step="0.01"
                     value={form.total_budget}
                     onChange={e => set("total_budget", e.target.value)}
                     placeholder="50,000"
                     className={INPUT_CLS}/>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ct-currency"
                     className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Currency
              </label>
              <select id="ct-currency"
                      value={form.currency}
                      onChange={e => set("currency", e.target.value)}
                      className={INPUT_CLS}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm
                               font-semibold text-slate-600 hover:bg-slate-50 transition-colors
                               active:scale-95">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                               rounded-xl text-sm font-semibold text-white sky-gradient
                               disabled:opacity-60 hover:opacity-90 transition-all
                               hover:shadow-md hover:shadow-blue-200 active:scale-95">
              {loading
                ? <Plane size={14} className="animate-plane-fly -rotate-45"/>
                : <Plane size={14} className="-rotate-45"/>}
              {loading ? "Creating…" : t("trip.createTrip")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
