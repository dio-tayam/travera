"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { generateShareToken } from "@/lib/utils";
import { TraveraSpinner } from "./travera-spinner";
import { X } from "lucide-react";
import { toast } from "sonner";

interface CreateTripDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const CURRENCIES = ["PHP", "USD", "EUR", "JPY", "KRW", "GBP", "AUD", "SGD", "HKD", "CNY"];

export function CreateTripDialog({ open, onClose, userId }: CreateTripDialogProps) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    destination: "",
    start_date: "",
    end_date: "",
    total_budget: "",
    currency: "PHP",
  });

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: trip, error } = await supabase
        .from("trips")
        .insert({
          owner_id: userId,
          title: form.title,
          destination: form.destination || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          total_budget: form.total_budget ? parseFloat(form.total_budget) : null,
          currency: form.currency,
          is_public: false,
          share_token: generateShareToken(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as member
      await supabase.from("trip_members").insert({
        trip_id: trip.id,
        user_id: userId,
        role: "owner",
      });

      toast.success("Trip created!");
      onClose();
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      toast.error("Failed to create trip");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-trip-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2
            id="create-trip-title"
            className="text-lg font-bold"
            style={{ color: "var(--color-foreground)", fontFamily: "var(--font-heading)" }}
          >
            {t("trip.createTrip")}
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
            <label
              htmlFor="trip-title"
              className="text-sm font-medium"
              style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
            >
              {t("trip.title")} *
            </label>
            <input
              id="trip-title"
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              style={{ fontFamily: "var(--font-body)", outlineColor: "var(--color-primary)" }}
              placeholder="Summer in Japan"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="trip-destination"
              className="text-sm font-medium"
              style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
            >
              {t("trip.destination")} <span className="text-gray-400">{t("common.optional")}</span>
            </label>
            <input
              id="trip-destination"
              type="text"
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ fontFamily: "var(--font-body)" }}
              placeholder="Tokyo, Japan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="trip-start"
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
              >
                {t("trip.startDate")}
              </label>
              <input
                id="trip-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="trip-end"
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
              >
                {t("trip.endDate")}
              </label>
              <input
                id="trip-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="trip-budget"
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
              >
                {t("trip.budget")}
              </label>
              <input
                id="trip-budget"
                type="number"
                min="0"
                step="0.01"
                value={form.total_budget}
                onChange={(e) => setForm((f) => ({ ...f, total_budget: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
                placeholder="50000"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="trip-currency"
                className="text-sm font-medium"
                style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
              >
                {t("trip.currency")}
              </label>
              <select
                id="trip-currency"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 bg-white"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
            >
              {loading ? <TraveraSpinner size={18} /> : null}
              {loading ? t("common.loading") : t("trip.createTrip")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
