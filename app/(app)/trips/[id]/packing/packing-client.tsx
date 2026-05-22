"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { Plus, X, Check, Loader2, ChevronDown, ChevronRight, Plane } from "lucide-react";
import { toast } from "sonner";

type Trip        = Database["public"]["Tables"]["trips"]["Row"];
type PackingItem = Database["public"]["Tables"]["packing_items"]["Row"];
type Member      = {
  user_id: string; role: string;
  profiles: Database["public"]["Tables"]["profiles"]["Row"] | null;
};

interface Props {
  trip: Trip; members: Member[];
  initialItems: PackingItem[]; userId: string; canEdit: boolean;
}

export function PackingClient({ trip, initialItems, canEdit }: Omit<Props, "members" | "userId">) {
  const { t } = useTranslation("common");
  const supabase = createClient();
  const [items, setItems]           = useState(initialItems);
  const [generating, setGen]        = useState(false);
  const [newLabel, setNewLabel]     = useState("");
  const [newCat, setNewCat]         = useState("Essentials");
  const [showAdd, setShowAdd]       = useState(false);
  const [collapsed, setCollapsed]   = useState<Record<string,boolean>>({});

  useEffect(() => {
    const ch = supabase.channel(`packing:${trip.id}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"packing_items",
           filter:`trip_id=eq.${trip.id}` }, () => {
        supabase.from("packing_items").select("*").eq("trip_id", trip.id).order("order_index")
          .then(({ data }) => { if (data) setItems(data); });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = items.reduce<Record<string,PackingItem[]>>((acc,item) => {
    const c = item.category ?? "Other";
    if (!acc[c]) acc[c] = [];
    acc[c].push(item);
    return acc;
  }, {});

  const total  = items.length;
  const packed = items.filter(i => i.is_packed).length;
  const pct    = total > 0 ? Math.round((packed / total) * 100) : 0;

  async function toggle(item: PackingItem) {
    if (!canEdit) return;
    const next = !item.is_packed;
    setItems(p => p.map(i => i.id === item.id ? { ...i, is_packed: next } : i));
    await supabase.from("packing_items").update({ is_packed: next }).eq("id", item.id);
  }

  async function remove(id: string) {
    setItems(p => p.filter(i => i.id !== id));
    await supabase.from("packing_items").delete().eq("id", id);
  }

  async function addItem() {
    if (!newLabel.trim()) return;
    const { data, error } = await supabase.from("packing_items").insert({
      trip_id: trip.id, label: newLabel.trim(), category: newCat || "Other",
      is_packed: false, order_index: items.length, assigned_to: null,
    }).select().single();
    if (error) { toast.error("Failed to add item"); return; }
    setItems(p => [...p, data]);
    setNewLabel("");
    toast.success("Item added");
  }

  async function generate() {
    setGen(true);
    const fallback = [
      { label:"Passport",             category:"Documents"   },
      { label:"Travel Insurance",     category:"Documents"   },
      { label:"Visa/E-visa",          category:"Documents"   },
      { label:"Phone Charger",        category:"Electronics" },
      { label:"Power Bank",           category:"Electronics" },
      { label:"Universal Adapter",    category:"Electronics" },
      { label:"Toothbrush",           category:"Toiletries"  },
      { label:"Sunscreen SPF 50+",    category:"Toiletries"  },
      { label:"Hand Sanitizer",       category:"Health"      },
      { label:"Paracetamol",          category:"Health"      },
      { label:"T-Shirts (×5)",        category:"Clothing"    },
      { label:"Walking Shoes",        category:"Clothing"    },
      { label:"Light Jacket",         category:"Clothing"    },
      { label:"Reusable Water Bottle",category:"Convenience" },
      { label:"Travel Pillow",        category:"Convenience" },
      { label:"Snacks",               category:"Convenience" },
    ];
    const existing = new Set(items.map(i => i.label.toLowerCase()));
    const newOnes  = fallback.filter(s => !existing.has(s.label.toLowerCase()));

    if (newOnes.length === 0) { toast.info("Nothing new to add!"); setGen(false); return; }

    const { data } = await supabase.from("packing_items").insert(
      newOnes.map((s,i) => ({
        trip_id: trip.id, label: s.label, category: s.category,
        is_packed: false, order_index: items.length + i, assigned_to: null,
      }))
    ).select();

    if (data) { setItems(p => [...p, ...data]); toast.success(`Added ${data.length} suggestions! ✈️`); }
    setGen(false);
  }

  return (
    <div className="min-h-screen pb-8 animate-fade-in" style={{ background:"var(--color-background)" }}>

      {/* Header */}
      <div className="px-4 lg:px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily:"var(--font-heading)" }}>
              {t("packing.title")}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{trip.title}</p>
          </div>
          {canEdit && (
            <div className="flex gap-2 shrink-0">
              <button onClick={generate} disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                                 disabled:opacity-60 hover:opacity-90 transition-all border border-amber-200
                                 bg-amber-50 text-amber-700 active:scale-95"
                      aria-label={t("packing.generateSuggestions")}>
                {generating
                  ? <Loader2 size={14} className="animate-spin"/>
                  : <span className="text-sm">✨</span>}
                {generating ? t("packing.generating") : "Suggest"}
              </button>
              <button onClick={() => setShowAdd(s => !s)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold
                                 text-white packing-gradient hover:opacity-90 transition-all active:scale-95"
                      aria-label={t("packing.addItem")}>
                <Plus size={16}/>
              </button>
            </div>
          )}
        </div>

        {/* Progress card */}
        <div className="card p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium text-slate-700">
              {packed} / {total} items packed
            </span>
            <span className="text-sm font-bold"
                  style={{ color: pct===100 ? "#10b981" : "var(--color-packing)" }}>
              {pct}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
                 style={{
                   width:`${pct}%`,
                   background: pct===100 ? "#10b981" : "linear-gradient(90deg, #10b981, #34d399)"
                 }}/>
          </div>
          {pct === 100 && total > 0 && (
            <p className="text-xs text-emerald-600 font-semibold mt-2 text-center animate-bounce-in">
              You&apos;re all packed! ✈️ Have a great trip!
            </p>
          )}
        </div>
      </div>

      {/* Add item inline */}
      {showAdd && canEdit && (
        <div className="px-4 lg:px-8 mb-4 animate-scale-in">
          <div className="card p-4 rounded-2xl flex gap-2 items-end">
            <div className="flex-1 space-y-2">
              <input type="text" value={newLabel} placeholder="Item name…"
                     onChange={e => setNewLabel(e.target.value)}
                     onKeyDown={e => { if (e.key==="Enter"){ e.preventDefault(); addItem(); }}}
                     className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                                focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"
                     autoFocus/>
              <input type="text" value={newCat} placeholder="Category"
                     onChange={e => setNewCat(e.target.value)}
                     className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm
                                focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow"/>
            </div>
            <button onClick={addItem}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white
                               packing-gradient hover:opacity-90 transition-all shrink-0 active:scale-95">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="px-4 lg:px-8 space-y-2.5">
        {items.length === 0 ? (
          <div className="card p-12 text-center rounded-2xl">
            <Plane size={40} className="mx-auto text-slate-200 -rotate-45 mb-4" aria-hidden="true"/>
            <p className="text-slate-400 text-sm mb-4">Your packing list is empty.</p>
            {canEdit && (
              <button onClick={generate} disabled={generating}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold
                                 bg-amber-50 text-amber-700 border border-amber-200
                                 hover:bg-amber-100 transition-colors active:scale-95">
                ✨ Generate suggestions
              </button>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catItems]) => {
            const catPacked = catItems.filter(i=>i.is_packed).length;
            const isOpen    = !collapsed[cat];
            const catPct    = catItems.length > 0 ? (catPacked / catItems.length) * 100 : 0;
            return (
              <div key={cat} className="card overflow-hidden rounded-2xl">
                <button onClick={() => setCollapsed(c=>({...c,[cat]:!c[cat]}))}
                        className="w-full flex items-center justify-between px-4 py-3.5
                                   hover:bg-slate-50 transition-colors"
                        aria-expanded={isOpen}>
                  <div className="flex items-center gap-2.5">
                    {isOpen
                      ? <ChevronDown size={14} className="text-slate-400"/>
                      : <ChevronRight size={14} className="text-slate-400"/>}
                    <span className="font-semibold text-slate-800 text-sm"
                          style={{ fontFamily:"var(--font-heading)" }}>{cat}</span>
                    <span className="text-xs text-slate-400">{catPacked}/{catItems.length}</span>
                  </div>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                         style={{
                           width: `${catPct}%`,
                           background: catPct===100 ? "#10b981" : "var(--color-packing)"
                         }}/>
                  </div>
                </button>

                {isOpen && (
                  <div className="divide-y divide-slate-50">
                    {catItems.map(item => (
                      <div key={item.id}
                           className="flex items-center gap-3 px-4 py-3 group transition-all"
                           style={{ opacity: item.is_packed ? 0.5 : 1 }}>
                        <button onClick={() => toggle(item)}
                                className="w-5 h-5 rounded-md border-2 flex items-center
                                           justify-center shrink-0 transition-all duration-150"
                                style={item.is_packed
                                  ? { background:"#10b981", borderColor:"#10b981" }
                                  : { borderColor:"#cbd5e1" }}
                                aria-label={item.is_packed ? "Mark unpacked":"Mark packed"}>
                          {item.is_packed && <Check size={11} className="text-white" strokeWidth={3}/>}
                        </button>
                        <span className="flex-1 text-sm text-slate-700 transition-all select-none"
                              style={{ textDecoration: item.is_packed ? "line-through" : "none" }}>
                          {item.label}
                        </span>
                        {canEdit && (
                          <button onClick={() => remove(item.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg
                                             text-slate-200 hover:text-red-400 transition-all"
                                  aria-label="Delete item">
                            <X size={13}/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
