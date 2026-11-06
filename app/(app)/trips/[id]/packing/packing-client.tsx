"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Backpack, Check, ChevronDown, Lightbulb, ListPlus, Lock, Pencil, Plus, RotateCcw, Shuffle, Trash2, User, UserRound, Users, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { cn } from "@/lib/utils";
import { PACKING_CATEGORIES, suggestPacking, type Suggestion } from "@/lib/packing-suggestions";
import type { Member } from "@/lib/types";
import type { PackingItemRow, Scope, TripRow } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Avatar, EmptyState, PageBody, PageHeader, Progress } from "@/components/ui/primitives";

type PackingItem = PackingItemRow;
type Tab = "group" | "mine";
type Filter = "all" | "todo" | "packed" | "unassigned" | `person:${string}`;

interface Props { trip: TripRow; initialItems: PackingItem[]; members: Member[]; userId: string; canEdit: boolean }

export function PackingClient({ trip, initialItems, members, userId, canEdit }: Props) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<Tab>("group");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>("Essentials");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [showSuggest, setShowSuggest] = useState(false);

  useRealtime(`packing:${trip.id}`, [{ table: "packing_items", filter: `trip_id=eq.${trip.id}` }], () => {
    supabase.from("packing_items").select("*").eq("trip_id", trip.id).order("order_index")
      .then(({ data }) => { if (data) setItems(data as PackingItem[]); });
  });

  useEffect(() => { setFilter("all"); }, [tab]);

  const catLabel = (c: string) => t(`packing.cats.${c}`, { defaultValue: c });
  const member = (uid: string | null) => members.find(m => m.user_id === uid);
  const nameOf = (uid: string) => uid === userId ? t("common.you") : member(uid)?.profiles?.display_name?.split(" ")[0] ?? t("common.traveler");

  const groupItems = items.filter(i => i.scope !== "personal");
  const personalItems = items.filter(i => i.scope === "personal" && i.created_by === userId);
  const assignedToMe = groupItems.filter(i => i.assigned_to === userId);

  /** Can the current user tick this item? */
  const canTick = (i: PackingItem) => i.scope === "personal" ? i.created_by === userId : canEdit || i.assigned_to === userId;
  /** Can the current user rename/delete/assign this item? */
  const canManage = (i: PackingItem) => i.scope === "personal" ? i.created_by === userId : canEdit;
  const canAddHere = tab === "mine" || canEdit;

  const list = tab === "group" ? groupItems : personalItems;
  const total = list.length;
  const packed = list.filter(i => i.is_packed).length;
  const pct = total ? Math.round((packed / total) * 100) : 0;
  const myAll = [...personalItems, ...assignedToMe];
  const myPacked = myAll.filter(i => i.is_packed).length;

  const shown = list.filter(i =>
    filter === "todo" ? !i.is_packed
    : filter === "packed" ? i.is_packed
    : filter === "unassigned" ? !i.assigned_to
    : filter.startsWith("person:") ? i.assigned_to === filter.slice(7)
    : true);
  const grouped = useMemo(() => {
    const g: Record<string, PackingItem[]> = {};
    shown.forEach(i => { (g[i.category || "Other"] ??= []).push(i); });
    return Object.entries(g);
  }, [shown]);

  const categories = Array.from(new Set([...PACKING_CATEGORIES, ...items.map(i => i.category)]));
  const suggestions = useMemo(() => {
    const have = new Set(list.map(i => i.label.toLowerCase()));
    return suggestPacking({ destination: trip.destination ?? trip.title, start: trip.start_date, end: trip.end_date }, t)
      .filter(s => !have.has(s.label.toLowerCase()));
  }, [list, trip.destination, trip.title, trip.start_date, trip.end_date, t]);

  /* ── Mutations (optimistic, rolled back on error) ───────────────────── */
  async function patch(id: string, change: Partial<PackingItem>, failKey: string) {
    const prev = items;
    setItems(p => p.map(i => i.id === id ? { ...i, ...change } : i));
    const { error } = await supabase.from("packing_items").update(change).eq("id", id);
    if (error) { setItems(prev); toast.error(t(failKey)); }
  }

  async function toggle(item: PackingItem) {
    if (!canTick(item)) return;
    const prev = items;
    setItems(p => p.map(i => i.id === item.id ? { ...i, is_packed: !item.is_packed } : i));
    // RPC so assignees (incl. viewers) can tick their own group items without full edit rights.
    const { error } = await supabase.rpc("set_packing_packed", { p_item_id: item.id, p_packed: !item.is_packed });
    if (error) { setItems(prev); toast.error(t("packing.errors.update")); }
  }
  const assign = (item: PackingItem, uid: string | null) => patch(item.id, { assigned_to: uid }, "packing.errors.assign");
  const rename = (item: PackingItem, next: string) =>
    next.trim() && next.trim() !== item.label && patch(item.id, { label: next.trim().slice(0, 120) }, "packing.errors.rename");

  async function remove(id: string) {
    const prev = items;
    setItems(p => p.filter(i => i.id !== id));
    const { error } = await supabase.from("packing_items").delete().eq("id", id);
    if (error) { setItems(prev); toast.error(t("packing.errors.remove")); }
  }

  async function insert(rows: { label: string; category: string }[], silent = false) {
    if (!rows.length) return;
    const scope: Scope = tab === "mine" ? "personal" : "group";
    const { data, error } = await supabase.from("packing_items").insert(rows.map((r, i) => ({
      trip_id: trip.id, label: r.label.slice(0, 120), category: r.category.slice(0, 40), is_packed: false,
      order_index: items.length + i, assigned_to: null, scope,
    }))).select();
    if (error || !data) { toast.error(t("packing.errors.add")); return; }
    setItems(p => [...p, ...(data as PackingItem[])]);
    if (!silent) toast.success(data.length === 1 ? t("packing.addedOne", { label: data[0].label }) : t("packing.addedMany", { count: data.length }));
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await insert([{ label: label.trim(), category: category.trim() || "Other" }], true);
    setLabel("");
  }

  async function unpackAll() {
    const ids = list.filter(i => i.is_packed && canTick(i)).map(i => i.id);
    if (!ids.length) return;
    const prev = items;
    setItems(p => p.map(i => ids.includes(i.id) ? { ...i, is_packed: false } : i));
    const { error } = await supabase.from("packing_items").update({ is_packed: false }).in("id", ids);
    if (error) { setItems(prev); toast.error(t("packing.errors.reset")); return; }
    toast.success(t("packing.unpackedAll"));
  }

  /** Spreads unassigned group items round-robin across travelers, starting with whoever has the fewest. */
  async function distribute() {
    const unassigned = groupItems.filter(i => !i.assigned_to && !i.is_packed);
    if (!unassigned.length || members.length < 2) return;
    const load = new Map(members.map(m => [m.user_id, groupItems.filter(i => i.assigned_to === m.user_id).length]));
    const plan = unassigned.map(item => {
      const [uid] = [...load.entries()].sort((a, b) => a[1] - b[1])[0];
      load.set(uid, (load.get(uid) ?? 0) + 1);
      return { id: item.id, uid };
    });
    const prev = items;
    setItems(p => p.map(i => { const x = plan.find(pl => pl.id === i.id); return x ? { ...i, assigned_to: x.uid } : i; }));
    const results = await Promise.all(plan.map(x => supabase.from("packing_items").update({ assigned_to: x.uid }).eq("id", x.id)));
    if (results.some(r => r.error)) { setItems(prev); toast.error(t("packing.errors.assign")); return; }
    toast.success(t("packing.distributed", { count: plan.length, people: members.length }));
  }

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("packing.filters.all"), count: total },
    { id: "todo", label: t("packing.filters.todo"), count: total - packed },
    { id: "packed", label: t("packing.packed"), count: packed },
    ...(tab === "group" && members.length > 1 ? [
      { id: "unassigned" as Filter, label: t("packing.filters.unassigned"), count: groupItems.filter(i => !i.assigned_to).length },
    ] : []),
  ];

  const unassignedCount = groupItems.filter(i => !i.assigned_to && !i.is_packed).length;

  return (
    <PageBody>
      <PageHeader
        eyebrow={t("nav.packing")}
        title={t("packing.title")}
        actions={<>
          {packed > 0 && (tab === "mine" || canEdit) && <Button variant="ghost" onClick={unpackAll}><RotateCcw size={15} aria-hidden="true" /> {t("packing.unpackAll")}</Button>}
          {canAddHere && (
            <Button variant="secondary" onClick={() => setShowSuggest(s => !s)} aria-expanded={showSuggest}>
              <Lightbulb size={15} aria-hidden="true" /> {t("packing.suggestions")}
              {suggestions.length > 0 && <span className="rounded-full bg-accent px-1.5 font-mono text-[10.5px] text-white">{suggestions.length}</span>}
            </Button>
          )}
        </>}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented label={t("packing.view")} value={tab} onChange={setTab} options={[
          { id: "group", label: t("packing.tabs.group"), icon: Users, count: groupItems.length },
          { id: "mine", label: t("packing.tabs.mine"), icon: User, count: personalItems.length },
        ]} />
        <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
          {tab === "group"
            ? <><Users size={13} aria-hidden="true" /> {canEdit ? t("packing.groupHint") : t("packing.groupHintViewer")}</>
            : <><Lock size={13} aria-hidden="true" /> {t("packing.mineHint")}</>}
        </p>
      </div>

      {/* Progress */}
      <div className="panel mt-4 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="eyebrow">{tab === "group" ? t("packing.groupProgress") : t("packing.myProgress")}</p>
            <p className="display mt-2 text-[44px] text-ink tabular">{packed}<span className="text-ink-3"> / {total}</span></p>
          </div>
          <div className="text-end">
            <p className={cn("text-[13px]", pct === 100 && total > 0 ? "font-medium text-positive" : "text-ink-2")}>
              {total === 0 ? t("packing.nothingYet") : pct === 100 ? t("packing.allPacked") : t("packing.leftToPack", { count: total - packed, pct })}
            </p>
            {myAll.length > 0 && (
              <p className="mt-0.5 text-[12px] text-ink-3">{t("packing.yourItems", { done: myPacked, total: myAll.length })}</p>
            )}
          </div>
        </div>
        <Progress value={pct} tone={pct === 100 ? "positive" : "ink"} className="mt-4 h-2" label={t("packing.progress")} />

        {/* Who's bringing what */}
        {tab === "group" && members.length > 1 && groupItems.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="eyebrow">{t("packing.whoBrings")}</p>
              {canEdit && unassignedCount > 0 && (
                <Button size="sm" variant="ghost" onClick={distribute} title={t("packing.distributeHint")}>
                  <Shuffle size={13} /> {t("packing.distribute", { count: unassignedCount })}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map(m => {
                const mine = groupItems.filter(i => i.assigned_to === m.user_id);
                const done = mine.filter(i => i.is_packed).length;
                const id = `person:${m.user_id}` as Filter;
                return (
                  <button key={m.user_id} onClick={() => setFilter(f => f === id ? "all" : id)} aria-pressed={filter === id}
                          className={cn("flex items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-[12.5px] transition-colors",
                                        filter === id ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:bg-sunken")}>
                    <Avatar name={m.profiles?.display_name} src={m.profiles?.avatar_url} size={22} />
                    {nameOf(m.user_id)}
                    <span className={cn("font-mono text-[11px]", filter === id ? "text-paper/60" : mine.length && done === mine.length ? "text-positive" : "text-ink-3")}>
                      {done}/{mine.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assigned to me (on my tab) */}
      {tab === "mine" && assignedToMe.length > 0 && (
        <div className="panel mt-4 overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13px] font-medium text-ink">
            <Users size={14} aria-hidden="true" /> {t("packing.assignedToYou")}
            <span className="font-mono text-[11.5px] font-normal text-ink-3">{assignedToMe.filter(i => i.is_packed).length}/{assignedToMe.length}</span>
          </p>
          <ul>
            {assignedToMe.map(item => (
              <PackingRow key={item.id} item={item} canTick canManage={false} members={members} nameOf={nameOf}
                          extra={catLabel(item.category)}
                          onToggle={() => toggle(item)} onRemove={() => {}} onAssign={() => {}} onRename={() => {}} />
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {canAddHere && showSuggest && (
        <div className="panel mt-4 animate-rise px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink"><Lightbulb size={15} className="text-accent" /> {t("packing.suggestedFor")}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">
                {trip.destination ? t("packing.basedOn", { place: trip.destination }) : t("packing.basedOnTrip")}
                {" "}{tab === "group" ? t("packing.addsToGroup") : t("packing.addsToMine")}
              </p>
            </div>
            <div className="flex gap-2">
              {suggestions.length > 0 && (
                <Button size="sm" onClick={() => insert(suggestions.map(({ label, category }) => ({ label, category })))}>
                  <ListPlus size={14} /> {t("packing.addAll", { count: suggestions.length })}
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" onClick={() => setShowSuggest(false)} aria-label={t("common.close")}><X size={15} /></Button>
            </div>
          </div>
          {suggestions.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-2">{t("packing.coversAll")}</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {suggestions.map((s: Suggestion) => (
                <li key={s.key}>
                  <button onClick={() => insert([{ label: s.label, category: s.category }])} title={s.why ?? catLabel(s.category)}
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
      {canAddHere && (
        <form onSubmit={addItem} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="pk-label" className="sr-only">{t("packing.itemName")}</label>
          <Input id="pk-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={120}
                 placeholder={tab === "group" ? t("packing.addGroupPlaceholder") : t("packing.addMinePlaceholder")} className="sm:flex-1" />
          <div className="flex gap-2">
            <label htmlFor="pk-cat" className="sr-only">{t("packing.category")}</label>
            <select id="pk-cat" value={category} onChange={e => setCategory(e.target.value)}
                    className="h-10 flex-1 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-ink sm:w-44">
              {categories.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
            <Button type="submit" disabled={!label.trim()}><Plus size={16} aria-hidden="true" /> {t("packing.add")}</Button>
          </div>
        </form>
      )}

      {/* Filters */}
      {total > 0 && (
        <div className="mt-8 flex gap-1.5 overflow-x-auto scrollbar-none" role="group" aria-label={t("packing.filterItems")}>
          {FILTERS.map(f => (
            <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                    className={cn("flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[12.5px] transition-colors",
                                  filter === f.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
              {f.label}
              <span className={cn("font-mono text-[11px]", filter === f.id ? "text-paper/60" : "text-ink-3")}>{f.count}</span>
            </button>
          ))}
          {filter.startsWith("person:") && (
            <button onClick={() => setFilter("all")} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-[12.5px] text-paper">
              {nameOf(filter.slice(7))} <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Lists */}
      <div className="mt-4">
        {total === 0 ? (
          <EmptyState icon={tab === "group" ? Backpack : Lock}
                      title={tab === "group" ? t("packing.emptyGroup") : t("packing.emptyMine")}
                      description={tab === "group" ? (canEdit ? t("packing.emptyGroupDesc") : t("packing.emptyGroupViewer")) : t("packing.emptyMineDesc")}
                      action={canAddHere && <Button variant="secondary" onClick={() => setShowSuggest(true)}><Lightbulb size={15} /> {t("packing.seeSuggestions")}</Button>} />
        ) : grouped.length === 0 ? (
          <p className="panel px-5 py-8 text-center text-[13px] text-ink-3">{t("packing.nothingHere")}</p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            {grouped.map(([cat, catItems]) => {
              const all = list.filter(i => (i.category || "Other") === cat);
              const done = all.filter(i => i.is_packed).length;
              const open = !collapsed[cat];
              return (
                <section key={cat} className="panel overflow-hidden">
                  <button onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))} aria-expanded={open}
                          className="flex w-full items-center gap-3 px-4 pb-3 pt-3.5 text-start transition-colors hover:bg-paper">
                    <span className="flex-1 text-[14px] font-semibold text-ink">{catLabel(cat)}</span>
                    <span className={cn("font-mono text-[11.5px]", done === all.length ? "text-positive" : "text-ink-3")}>{done}/{all.length}</span>
                    <ChevronDown size={16} className={cn("text-ink-3 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
                  </button>
                  <Progress value={all.length ? (done / all.length) * 100 : 0} tone={done === all.length ? "positive" : "ink"} className="h-[3px] rounded-none" />
                  {open && (
                    <>
                      <ul>
                        {catItems.map(item => (
                          <PackingRow key={item.id} item={item} canTick={canTick(item)} canManage={canManage(item)}
                                      members={tab === "group" ? members : []} nameOf={nameOf}
                                      onToggle={() => toggle(item)} onRemove={() => remove(item.id)}
                                      onAssign={uid => assign(item, uid)} onRename={v => rename(item, v)} />
                        ))}
                      </ul>
                      {canAddHere && <QuickAdd onAdd={l => insert([{ label: l, category: cat }], true)} />}
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

function PackingRow({ item, canTick, canManage, members, nameOf, onToggle, onRemove, onAssign, onRename, extra }: {
  item: PackingItemRow; canTick: boolean; canManage: boolean; members: Member[]; nameOf: (uid: string) => string;
  onToggle: () => void; onRemove: () => void; onAssign: (uid: string | null) => void; onRename: (v: string) => void;
  extra?: string;
}) {
  const { t } = useTranslation("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.label);
  const assignee = members.find(m => m.user_id === item.assigned_to);

  return (
    <li className="group flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
      <button onClick={onToggle} disabled={!canTick} role="checkbox" aria-checked={item.is_packed} aria-label={item.label}
              title={canTick ? undefined : t("packing.cantTick")}
              className={cn("grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            item.is_packed ? "border-ink bg-ink text-paper" : "border-line-strong hover:border-ink")}>
        {item.is_packed && <Check size={12} strokeWidth={3} aria-hidden="true" />}
      </button>

      {editing ? (
        <form className="flex-1" onSubmit={e => { e.preventDefault(); onRename(draft); setEditing(false); }}>
          <Input autoFocus value={draft} onChange={e => setDraft(e.target.value)} className="h-8" maxLength={120}
                 onBlur={() => { onRename(draft); setEditing(false); }}
                 onKeyDown={e => { if (e.key === "Escape") { setDraft(item.label); setEditing(false); } }} aria-label={t("packing.itemName")} />
        </form>
      ) : (
        <span onClick={canTick ? onToggle : undefined} onDoubleClick={() => canManage && setEditing(true)}
              className={cn("min-w-0 flex-1 select-none truncate text-[13.5px] transition-colors", canTick && "cursor-pointer",
                            item.is_packed ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink")}>
          {item.label}
          {extra && <span className="ms-2 text-[11.5px] text-ink-3 no-underline">{extra}</span>}
        </span>
      )}

      {/* Assignee */}
      {members.length > 1 && (canManage ? (
        <Menu.Root>
          <Menu.Trigger aria-label={assignee ? t("packing.assignedTo", { name: nameOf(assignee.user_id) }) : t("packing.assign")}
                        title={assignee ? t("packing.assignedTo", { name: nameOf(assignee.user_id) }) : t("packing.assign")}
                        className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full transition-opacity",
                                      !assignee && "text-ink-3 hover:bg-sunken lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 data-[state=open]:opacity-100")}>
            {assignee ? <Avatar name={assignee.profiles?.display_name} src={assignee.profiles?.avatar_url} size={24} /> : <UserRound size={15} />}
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={4}
                          className="z-50 min-w-[180px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise">
              <Menu.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-3">{t("packing.whosBringing")}</Menu.Label>
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
                  <X size={14} /> {t("packing.unassign")}
                </Menu.Item>
              )}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      ) : assignee && (
        <span title={t("packing.assignedTo", { name: nameOf(assignee.user_id) })}>
          <Avatar name={assignee.profiles?.display_name} src={assignee.profiles?.avatar_url} size={24} />
        </span>
      ))}

      {canManage && !editing && (
        <div className="flex shrink-0 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
          <button onClick={() => { setDraft(item.label); setEditing(true); }} aria-label={t("packing.renameAria", { label: item.label })}
                  className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink">
            <Pencil size={13} />
          </button>
          <button onClick={onRemove} aria-label={t("packing.removeAria", { label: item.label })}
                  className="grid h-7 w-7 place-items-center rounded-md text-ink-3 transition-colors hover:bg-negative-soft hover:text-negative">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </li>
  );
}

function QuickAdd({ onAdd }: { onAdd: (label: string) => void }) {
  const { t } = useTranslation("common");
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form className="flex items-center gap-2 border-t border-line px-4 py-1.5"
          onSubmit={e => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); setValue(""); ref.current?.focus(); } }}>
      <Plus size={14} className="shrink-0 text-ink-3" aria-hidden="true" />
      <input ref={ref} value={value} onChange={e => setValue(e.target.value)} placeholder={t("packing.addToList")} maxLength={120}
             aria-label={t("packing.addToCategory")}
             className="h-8 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none" />
    </form>
  );
}
