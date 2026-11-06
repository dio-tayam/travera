"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES } from "@/lib/categories";
import type { TripRow } from "@/types/database";
import { Modal, ModalActions } from "@/components/ui/modal";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function TripEditDialog({ trip, open, onClose, onSaved }: {
  trip: TripRow; open: boolean; onClose: () => void; onSaved: (t: TripRow) => void;
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const [form, setForm] = useState({
    title: trip.title, destination: trip.destination ?? "", start_date: trip.start_date ?? "", end_date: trip.end_date ?? "",
    total_budget: trip.total_budget != null ? String(trip.total_budget) : "", currency: trip.currency,
    cover_image_url: trip.cover_image_url ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => { setForm(f => ({ ...f, [k]: v })); setError(null); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError(t("createTrip.errors.name")); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) { setError(t("createTrip.errors.dates")); return; }
    const cover = form.cover_image_url.trim();
    if (cover && !/^https:\/\/\S+$/i.test(cover)) { setError(t("editTrip.errors.cover")); return; }
    const budget = form.total_budget ? Number(form.total_budget) : null;
    if (budget != null && (!Number.isFinite(budget) || budget < 0)) { setError(t("editTrip.errors.budget")); return; }
    setSaving(true);
    const patch = {
      title: form.title.trim().slice(0, 120), destination: form.destination.trim() || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      total_budget: budget, currency: form.currency, cover_image_url: cover || null,
    };
    const { data, error: err } = await createClient().from("trips").update(patch).eq("id", trip.id).select().single();
    setSaving(false);
    if (err || !data) { setError(t("editTrip.errors.failed")); return; }
    toast.success(t("editTrip.saved"));
    onSaved(data as TripRow);
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }} title={t("trip.editTrip")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <Field label={t("createTrip.name")} htmlFor="et-title">
          <Input id="et-title" value={form.title} onChange={e => set("title", e.target.value)} maxLength={120} required />
        </Field>
        <Field label={t("trip.destination")} htmlFor="et-dest" optional>
          <Input id="et-dest" value={form.destination} onChange={e => set("destination", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("createTrip.departure")} htmlFor="et-start">
            <Input id="et-start" type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
          </Field>
          <Field label={t("createTrip.return")} htmlFor="et-end">
            <Input id="et-end" type="date" value={form.end_date} min={form.start_date || undefined}
                   onChange={e => set("end_date", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label={t("trip.budget")} htmlFor="et-budget" optional hint={t("editTrip.budgetHint")}>
            <Input id="et-budget" type="number" inputMode="decimal" min="0" step="0.01" value={form.total_budget}
                   onChange={e => set("total_budget", e.target.value)} />
          </Field>
          <Field label={t("trip.currency")} htmlFor="et-currency">
            <Select id="et-currency" value={form.currency} onChange={e => set("currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t("editTrip.cover")} htmlFor="et-cover" optional hint={t("editTrip.coverHint")}>
          <Input id="et-cover" type="url" inputMode="url" value={form.cover_image_url} placeholder="https://"
                 onChange={e => set("cover_image_url", e.target.value)} />
        </Field>
        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" loading={saving}>{t("common.save")}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
