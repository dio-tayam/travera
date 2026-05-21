"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { Plus, X, Check, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TraveraSpinner } from "@/components/shared/travera-spinner";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type PackingItem = Database["public"]["Tables"]["packing_items"]["Row"];
type Member = {
  user_id: string;
  role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

interface PackingClientProps {
  trip: Trip;
  members: Member[];
  initialItems: PackingItem[];
  userId: string;
  canEdit: boolean;
}

export function PackingClient({ trip, members, initialItems, userId, canEdit }: PackingClientProps) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [items, setItems] = useState<PackingItem[]>(initialItems);
  const [generating, setGenerating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("Essentials");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`packing:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "packing_items", filter: `trip_id=eq.${trip.id}` }, () => {
        supabase.from("packing_items").select("*").eq("trip_id", trip.id).order("order_index")
          .then(({ data }) => { if (data) setItems(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [trip.id, supabase]);

  const grouped = items.reduce<Record<string, PackingItem[]>>((acc, item) => {
    const cat = item.category ?? "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalItems = items.length;
  const packedItems = items.filter((i) => i.is_packed).length;
  const progress = totalItems > 0 ? Math.round((packedItems / totalItems) * 100) : 0;

  async function toggleItem(item: PackingItem) {
    const updated = { ...item, is_packed: !item.is_packed };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    await supabase.from("packing_items").update({ is_packed: updated.is_packed }).eq("id", item.id);
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("packing_items").delete().eq("id", id);
  }

  async function addItem() {
    if (!newLabel.trim()) return;
    const { data, error } = await supabase
      .from("packing_items")
      .insert({
        trip_id: trip.id,
        label: newLabel.trim(),
        category: newCategory,
        is_packed: false,
        order_index: items.length,
        assigned_to: null,
      })
      .select()
      .single();
    if (error) { toast.error("Failed to add item"); return; }
    setItems((prev) => [...prev, data]);
    setNewLabel("");
    toast.success("Item added!");
  }

  async function generateSuggestions() {
    setGenerating(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/suggest-packing-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          destination: trip.destination,
          start_date: trip.start_date,
          end_date: trip.end_date,
        }),
      });

      if (!res.ok) throw new Error("Edge function failed");

      const suggestions: Array<{ label: string; category: string }> = await res.json();
      const existing = new Set(items.map((i) => i.label.toLowerCase()));
      const newItems = suggestions.filter((s) => !existing.has(s.label.toLowerCase()));

      if (newItems.length === 0) {
        toast.info("No new suggestions to add!");
        return;
      }

      const { data, error } = await supabase
        .from("packing_items")
        .insert(
          newItems.map((s, i) => ({
            trip_id: trip.id,
            label: s.label,
            category: s.category,
            is_packed: false,
            order_index: items.length + i,
            assigned_to: null,
          }))
        )
        .select();

      if (error) throw error;
      setItems((prev) => [...prev, ...(data ?? [])]);
      toast.success(`Added ${newItems.length} suggestions!`);
    } catch {
      // Fallback: add common suggestions
      const fallback = [
        { label: "Passport", category: "Documents" },
        { label: "Travel Insurance", category: "Documents" },
        { label: "Phone Charger", category: "Electronics" },
        { label: "Power Bank", category: "Electronics" },
        { label: "Sunscreen", category: "Toiletries" },
        { label: "Toothbrush", category: "Toiletries" },
        { label: "T-Shirts", category: "Clothing" },
        { label: "Walking Shoes", category: "Clothing" },
      ];
      const existing = new Set(items.map((i) => i.label.toLowerCase()));
      const newItems = fallback.filter((s) => !existing.has(s.label.toLowerCase()));
      if (newItems.length > 0) {
        const { data } = await supabase
          .from("packing_items")
          .insert(newItems.map((s, i) => ({ trip_id: trip.id, label: s.label, category: s.category, is_packed: false, order_index: items.length + i, assigned_to: null })))
          .select();
        setItems((prev) => [...prev, ...(data ?? [])]);
        toast.success(`Added ${newItems.length} suggestions!`);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <div className="px-4 lg:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {t("packing.title")}
            </h1>
            <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-body)" }}>{trip.title}</p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <button
                  onClick={generateSuggestions}
                  disabled={generating}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "var(--color-gold)", color: "var(--color-primary)", fontFamily: "var(--font-body)" }}
                  aria-label={t("packing.generateSuggestions")}
                >
                  {generating ? <Loader2 size={15} className="animate-spin" /> : <span>✨</span>}
                  {generating ? t("packing.generating") : t("packing.generateSuggestions")}
                </button>
                <button
                  onClick={() => setShowAdd((s) => !s)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
                  aria-label={t("packing.addItem")}
                >
                  <Plus size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>
              {packedItems} / {totalItems} packed
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-body)" }}>
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#16a34a" : "var(--color-primary)" }}
            />
          </div>
        </div>
      </div>

      {/* Add item form */}
      {showAdd && canEdit && (
        <div className="px-4 lg:px-6 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); }}}
                placeholder="Item name..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
                autoFocus
              />
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Category"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2"
                style={{ fontFamily: "var(--font-body)" }}
              />
            </div>
            <button
              onClick={addItem}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Categories accordion */}
      <div className="px-4 lg:px-6 space-y-3">
        {Object.entries(grouped).map(([category, catItems]) => {
          const isCollapsed = collapsed[category];
          const catPacked = catItems.filter((i) => i.is_packed).length;
          return (
            <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [category]: !c[category] }))}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                aria-expanded={!isCollapsed}
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)" }}>{category}</span>
                  <span className="text-xs text-gray-400" style={{ fontFamily: "var(--font-body)" }}>
                    {catPacked}/{catItems.length}
                  </span>
                </div>
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${catItems.length > 0 ? (catPacked / catItems.length) * 100 : 0}%`,
                      backgroundColor: "var(--color-primary)"
                    }}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-50">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 group transition-opacity"
                      style={{ opacity: item.is_packed ? 0.4 : 1 }}
                    >
                      <button
                        onClick={() => canEdit && toggleItem(item)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          item.is_packed ? "border-transparent" : "border-gray-300 hover:border-blue-400"
                        }`}
                        style={item.is_packed ? { backgroundColor: "var(--color-primary)", borderColor: "var(--color-primary)" } : {}}
                        aria-label={item.is_packed ? "Mark unpacked" : "Mark packed"}
                      >
                        {item.is_packed && <Check size={12} className="text-white" strokeWidth={3} />}
                      </button>
                      <span
                        className="flex-1 text-sm"
                        style={{
                          textDecoration: item.is_packed ? "line-through" : "none",
                          fontFamily: "var(--font-body)",
                          transition: "text-decoration 0.2s",
                        }}
                      >
                        {item.label}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete item"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="bg-white rounded-xl p-10 text-center shadow-sm">
            <p className="text-sm text-gray-400 mb-4" style={{ fontFamily: "var(--font-body)" }}>
              Your packing list is empty.
            </p>
            {canEdit && (
              <button
                onClick={generateSuggestions}
                disabled={generating}
                className="px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: "var(--color-gold)", color: "var(--color-primary)", fontFamily: "var(--font-body)" }}
              >
                {generating ? <Loader2 size={16} className="animate-spin inline mr-2" /> : "✨ "}
                {t("packing.generateSuggestions")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
