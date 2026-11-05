"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { toast } from "sonner";
import {
  Backpack, Check, ChevronDown, ListPlus, Pencil, Plus, RotateCcw, Lightbulb, Trash2, UserRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { suggestPacking, type Suggestion } from "@/lib/packing-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Avatar, EmptyState, PageBody, PageHeader, Progress } from "@/components/ui/primitives";
import type { Database } from "@/types/database";

type Trip = Database["public"]["Tables"]["trips"]["Row"];
type PackingItem = Database["public"]["Tables"]["packing_items"]["Row"];
type Member = { user_id: string; role: string; profiles: Database["public"]["Tables"]["profiles"]["Row"] | null };

interface Props { trip: Trip; initialItems: PackingItem[]; members: Member[]; userId: string; canEdit: boolean }

type Filter = "all" | "todo" | "packed" | "mine";

export function PackingClient({ trip, initialItems, members, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Essentials");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    const ch = supabase.channel(`packing:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "packing_items", filter: `trip_id=eq.${trip.id}` }, () => {
        supabase.from("packing_items").select("*").eq("trip_id", trip.id).order("order_index")
          .then(({ data }) => { if (data) setItems(data); });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const member = (uid: string | null) => members.find(m => m.user_id === uid);
  const nameOf = (uid: string) => uid === userId ? "You" : member(uid)?.profiles?.display_name?.split(" ")[0] ?? "Traveler";

  const total = items.length;
  const packed = items.filter(i => i.is_packed).length;
  const pct = total ? Math.round((packed / total) * 100) : 0;
  const mine = items.filter(i => i.assigned_to === userId);
  const minePacked = mine.filter(i => i.is_packed).length;

  const shown = items.filter(i =>
    filter === "todo" ? !i.is_packed : filter === "packed" ? i.is_packed : filter === "mine" ? i.assigned_to === userId : true);
  const grouped = useMemo(() => {
    const g: Record<string, PackingItem[]> = {};
    shown.forEach(i => { (g[i.category || "Other"] ??= []).push(i); });
    return Object.entries(g);
  }, [shown]);

  const categories = Array.from(new Set(["Essentials", "Clothing", "Toiletries", "Electronics", "Documents", "Health", ...items.map(i => i.category)]));
  const suggestions = useMemo(() => {
    const have = new Set(items.map(i => i.label.toLowerCase()));
    return suggestPacking({ destination: trip.destination ?? trip.title, start: trip.start_date, end: trip.end_date })
      .filter(s => !have.has(s.label.toLowerCase()));
  }, [items, trip.destination, trip.title, trip.start_date, trip.end_date]);

  /* ── Mutations (optimistic, rolled back on error) ───────────────────── */
  async function patch(id: string, change: Partial<PackingItem>, failMsg: string) {
    const prev = items;
    setItems(p => p.map(i => i.id === id ? { ...i, ...change } : i));
    const { error } = await supabase.from("packing_items").update(change).eq("id", id);
    if (error) { setItems(prev); toast.error(failMsg); }
  }

  const toggle = (item: PackingItem) => canEdit && patch(item.id, { is_packed: !item.is_packed }, "Couldn't update the item");
  const assign = (item: PackingItem, uid: string | null) => patch(item.id, { assigned_to: uid }, "Couldn't assign the item");
  const rename = (item: PackingItem, next: string) => next.trim() && next.trim() !== item.label && patch(item.id, { label: next.trim() }, "Couldn't rename the item");

  async function remove(id: string) {
    const prev = items;
    setItems(p => p.filter(i => i.id !== id));
    const { error } = await supabase.from("packing_items").delete().eq("id", id);
    if (error) { setItems(prev); toast.error("Couldn't remove the item"); }
  }

  async function insert(rows: { label: string; category: string }[], silent = false) {
    if (!rows.length) return;
    const { data, error } = await supabase.from("packing_items").insert(rows.map((r, i) => ({
      trip_id: trip.id, label: r.label, category: r.category, is_packed: false, order_index: items.length + i, assigned_to: null,
    }))).select();
    if (error || !data) { toast.error("Couldn't add items"); return; }
    setItems(p => [...p, ...data]);
    if (!silent) toast.success(data.length === 1 ? `Added "${data[0].label}"` : `Added ${data.length} items`);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await insert([{ label: label.trim(), category: category.trim() || "Other" }], true);
    setLabel("");
  }

  async function unpackAll() {
    const ids = items.filter(i => i.is_packed).map(i => i.id);
    if (!ids.length) return;
    const prev = items;
    setItems(p => p.map(i => ({ ...i, is_packed: false })));
    const { error } = await supabase.from("packing_items").update({ is_packed: false }).in("id", ids);
    if (error) { setItems(prev); toast.error("Couldn't reset the list"); return; }
    toast.success("Everything unpacked — ready for the trip home");
  }

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    { id: "todo", label: "To pack", count: total - packed },
    { id: "packed", label: t("packing.packed"), count: packed },
    ...(members.length > 1 ? [{ id: "mine" as Filter, label: "Mine", count: mine.length }] : []),
  ];

  return (
    <PageBody>
      <PageHeader
        eyebrow={t("nav.packing")}
        title={t("packing.title")}
        actions={canEdit && <>
          {packed > 0 && <Button variant="ghost" onClick={unpackAll}><RotateCcw size={15} aria-hidden="true" /> Unpack all</Button>}
          <Button variant="secondary" onClick={() => setShowSuggest(s => !s)} aria-expanded={showSuggest}>
            <Lightbulb size={15} aria-hidden="true" /> Suggestions
            {suggestions.length > 0 && <span className="rounded-full bg-accent px-1.5 font-mono text-[10.5px] text-white">{suggestions.length}</span>}
          </Button>
        </>}
      />

      {/* Progress */}
      <div className="panel mt-8 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="eyebrow">{t("packing.packed")}</p>
            <p className="display mt-2 text-[44px] text-ink tabular">{packed}<span className="text-ink-3"> / {total}</span></p>
          </div>
          <div className="text-right">
            <p className={cn("text-[13px]", pct === 100 && total > 0 ? "font-medium text-positive" : "text-ink-2")}>
              {total === 0 ? "Nothing on the list yet" : pct === 100 ? "Everything's packed. Have a great trip." : `${total - packed} left to pack · ${pct}%`}
            </p>
            {mine.length > 0 && (
              <p className="mt-0.5 text-[12px] text-ink-3">Your items: {minePacked}/{mine.length} packed</p>
            )}
          </div>
        </div>
        <Progress value={pct} tone={pct === 100 ? "positive" : "ink"} className="mt-4 h-2" label="Packing progress" />
      </div>

      {/* Suggestions */}
      {canEdit && showSuggest && (
        <div className="panel mt-4 animate-rise px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Lightbulb size={15} className="text-accent" /> Suggested for this trip</p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">
                Based on {trip.destination ? <b className="font-medium text-ink-2">{trip.destination}</b> : "your trip"}
                {trip.start_date && ", the season"} and trip length. Tap to add.
              </p>
            </div>
            <div className="flex gap-2">
              {suggestions.length > 0 && (
                <Button size="sm" onClick={() => insert(suggestions.map(({ label, category }) => ({ label, category })))}>
                  <ListPlus size={14} /> Add all {suggestions.length}
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" onClick={() => setShowSuggest(false)} aria-label="Close suggestions"><X size={15} /></Button>
            </div>
          </div>
          {suggestions.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-2">Your list already covers everything we&apos;d suggest.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {suggestions.map((s: Suggestion) => (
                <li key={s.label}>
                  <button onClick={() => insert([{ label: s.label, category: s.category }])} title={s.why ?? s.category}
                          className="group flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] text-ink transition-all hover:-translate-y-0.5 hover:border-ink">
                    <Plus size={12} className="text-ink-3 group-hover:text-ink" />
                    {s.label}
                    {s.why && <span className="text-[11px] text-accent-ink">· {s.why}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Add item */}
      {canEdit && (
        <form onSubmit={addItem} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="pk-label" className="sr-only">{t("packing.itemName")}</label>
          <Input id="pk-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="Add an item, e.g. Rain jacket" className="sm:flex-1" />
          <div className="flex gap-2">
            <label htmlFor="pk-cat" className="sr-only">{t("packing.category")}</label>
            <Input id="pk-cat" value={category} onChange={e => setCategory(e.target.value)} list="pk-categories"
                   placeholder={t("packing.category")} className="flex-1 sm:w-44" />
            <datalist id="pk-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
            <Button type="submit" disabled={!label.trim()}><Plus size={16} aria-hidden="true" /> {t("packing.add")}</Button>
          </div>
        </form>
      )}

      {/* Filters */}
      {total > 0 && (
        <div className="mt-8 flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Filter items">
          {FILTERS.map(f => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
                    className={cn("flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[12.5px] transition-colors",
                                  filter === f.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
              {f.label}
              <span className={cn("font-mono text-[11px]", filter === f.id ? "text-paper/60" : "text-ink-3")}>{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Lists */}
      <div className="mt-4">
        {total === 0 ? (
          <EmptyState icon={Backpack} title={t("packing.emptyList")}
                      description="Add items one by one, or start from suggestions tailored to your destination."
                      action={canEdit && <Button variant="secondary" onClick={() => setShowSuggest(true)}><Lightbulb size={15} /> See suggestions</Button>} />
        ) : grouped.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">
            {filter === "mine" ? "Nothing assigned to you yet." : filter === "packed" ? "Nothing packed yet." : "All packed!"}
          </p>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {grouped.map(([cat, list]) => {
              const all = items.filter(i => (i.category || "Other") === cat);
              const done = all.filter(i => i.is_packed).length;
              const open = !collapsed[cat];
              return (
                <section key={cat} className="panel overflow-hidden">
                  <button onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))} aria-expanded={open}
                          className="flex w-full items-center gap-3 px-4 pb-3 pt-3.5 text-left transition-colors hover:bg-paper">
                    <span className="flex-1 text-[14px] font-semibold text-ink">{cat}</span>
                    <span className={cn("font-mono text-[11.5px]", done === all.length ? "text-positive" : "text-ink-3")}>{done}/{all.length}</span>
                    <ChevronDown size={16} className={cn("text-ink-3 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
                  </button>
                  <Progress value={all.length ? (done / all.length) * 100 : 0} tone={done === all.length ? "positive" : "ink"} className="h-[3px] rounded-none" />
                  {open && (
                    <>
                      <ul>
                        {list.map(item => (
                          <PackingRow key={item.id} item={item} canEdit={canEdit} members={members} nameOf={nameOf}
                                      onToggle={() => toggle(item)} onRemove={() => remove(item.id)}
                                      onAssign={uid => assign(item, uid)} onRename={v => rename(item, v)} />
                        ))}
                      </ul>
                      {canEdit && <QuickAdd onAdd={l => insert([{ label: l, category: cat }], true)} />}
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageBody>
  );
}

function PackingRow({ item, canEdit, members, nameOf, onToggle, onRemove, onAssign, onRename }: {
  item: PackingItem; canEdit: boolean; members: Member[]; nameOf: (uid: string) => string;
  onToggle: () => void; onRemove: () => void; onAssign: (uid: string | null) => void; onRename: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const assignee = members.find(m => m.user_id === item.assigned_to);

  return (
    <li className="group flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
      <button onClick={onToggle} disabled={!canEdit} role="checkbox" aria-checked={item.is_packed} aria-label={item.label}
              className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors disabled:cursor-default",
                            item.is_packed ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink")}>
        {item.is_packed && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      {editing ? (
        <form className="flex-1" onSubmit={e => { e.preventDefault(); onRename(draft); setEditing(false); }}>
          <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)} className="h-8"
                 onBlur={() => { onRename(draft); setEditing(false); }}
                 onKeyDown={e => { if (e.key === "Escape") { setDraft(item.label); setEditing(false); } }} aria-label="Item name" />
        </form>
      ) : (
        <span onClick={onToggle} onDoubleClick={() => canEdit && setEditing(true)}
              className={cn("min-w-0 flex-1 cursor-pointer select-none truncate text-[13.5px] transition-colors",
                            item.is_packed ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>
          {item.label}
        </span>
      )}

      {/* Assignee */}
      {members.length > 1 && (canEdit ? (
        <Menu.Root>
          <Menu.Trigger aria-label={assignee ? `Assigned to ${nameOf(assignee.user_id)}` : "Assign to a traveler"}
                        title={assignee ? `Assigned to ${nameOf(assignee.user_id)}` : "Assign"}
                        className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full transition-opacity",
                                      !assignee && "text-ink-3 hover:bg-sunken lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 data-[state=open]:opacity-100")}>
            {assignee ? <Avatar name={assignee.profiles?.display_name} src={assignee.profiles?.avatar_url} size={24} /> : <UserRound size={15} />}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4}
                          className="z-50 min-w-[180px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise">
              <Menu.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">Who&apos;s bringing it?</Menu.Label>
              {members.map(m => (
                <Menu.Item key={m.user_id} onSelect={() => onAssign(m.user_id)}
                           className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken">
                  <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={22} />
                  <span className="flex-1">{nameOf(m.user_id)}</span>
                  {m.user_id === item.assigned_to && <Check size={13} className="text-accent" />}
                </Menu.Item>
              ))}
              {item.assigned_to && (
                <Menu.Item onSelect={() => onAssign(null)}
                           className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-[8px] border-t border-line px-2.5 py-1.5 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-sunken">
                  <X size={14} /> Unassign
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      ) : assignee && <Avatar name={assignee.profiles?.display_name} src={assignee.profiles?.avatar_url} size={24} />)}

      {canEdit && !editing && (
        <div className="flex shrink-0 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button onClick={() => { setDraft(item.label); setEditing(true); }} aria-label={`Rename ${item.label}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
            <Pencil size={13} />
          </button>
          <button onClick={onRemove} aria-label={`Remove ${item.label}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
}

function QuickAdd({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form className="flex items-center gap-2 border-t border-line px-4 py-1.5"
          onSubmit={e => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); ref.current?.focus(); } }}>
      <Plus size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
      <input ref={ref} value={value} onChange={e => setValue(e.target.value)} placeholder="Add to this list"
             aria-label="Add item to this category"
             className="h-8 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none" />
    </form>
  );
}
