"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { generateShareToken } from "@/lib/utils";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface Props { open: boolean; onClose: () => void; userId: string }

const CURRENCIES = ["PHP", "USD", "EUR", "JPY", "KRW", "GBP", "AUD", "SGD", "THB", "CNY"];
const EMPTY = { title: "", destination: "", start_date: "", end_date: "", total_budget: "", currency: "PHP" };

export function CreateTripDialog({ open, onClose, userId }: Props) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Give your trip a name."); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("The return date can't be before departure."); return;
    }
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

      const { data: trip, error: tripErr } = await supabase.from("trips").insert({
        owner_id: userId,
        title: form.title.trim(),
        destination: form.destination.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        total_budget: form.total_budget ? parseFloat(form.total_budget) : null,
        currency: form.currency,
        is_public: false,
        share_token: generateShareToken(),
      }).select().single();
      if (tripErr) throw new Error(tripErr.message);

      const { error: memberErr } = await supabase.from("trip_members")
        .insert({ trip_id: trip.id, user_id: userId, role: "owner" });
      if (memberErr) throw new Error(memberErr.message);

      toast.success("Trip created");
      setForm(EMPTY);
      onClose();
      router.push(`/trips/${trip.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create the trip.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }}
           title="New trip" description="You can change any of this later.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>

        <Field label="Trip name" htmlFor="ct-title">
          <Input id="ct-title" autoFocus value={form.title} onChange={e => set("title", e.target.value)}
                 placeholder="Spring in Tokyo" required />
        </Field>

        <Field label={t("trip.destination")} htmlFor="ct-dest" optional>
          <Input id="ct-dest" value={form.destination} onChange={e => set("destination", e.target.value)}
                 placeholder="Tokyo, Japan" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Departure" htmlFor="ct-start">
            <Input id="ct-start" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
          </Field>
          <Field label="Return" htmlFor="ct-end">
            <Input id="ct-end" type="date" value={form.end_date} min={form.start_date || undefined}
                   onChange={e => set("end_date", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t("trip.budget")} htmlFor="ct-budget" optional>
            <Input id="ct-budget" type="number" inputMode="decimal" min="0" step="0.01"
                   value={form.total_budget} onChange={e => set("total_budget", e.target.value)} placeholder="50,000" />
          </Field>
          <Field label={t("trip.currency")} htmlFor="ct-currency">
            <Select id="ct-currency" value={form.currency} onChange={e => set("currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" loading={loading}>{loading ? "Creating…" : t("trip.createTrip")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
