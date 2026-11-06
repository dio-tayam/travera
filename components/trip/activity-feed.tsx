"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Activity, Backpack, FileText, Lock, MapPin, Settings2, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";
import { cn, formatCurrency, formatRelative } from "@/lib/utils";
import type { Member } from "@/lib/types";
import type { AuditLogRow } from "@/types/database";

type Kind = "all" | "itinerary" | "budget" | "packing" | "docs" | "travelers";

const KIND_OF: Record<string, Exclude<Kind, "all">> = {
  stops: "itinerary", trips: "itinerary", expenses: "budget", expense_splits: "budget",
  packing_items: "packing", documents: "docs", trip_members: "travelers",
};
const ICON_OF: Record<string, LucideIcon> = {
  stops: MapPin, trips: Settings2, expenses: Wallet, expense_splits: Wallet,
  packing_items: Backpack, documents: FileText, trip_members: Users,
};

/** Renders one audit row as a human sentence in the current language. */
export function describeActivity(row: AuditLogRow, t: TFunction, nameOf: (uid: string | null | undefined) => string, currency: string) {
  const m = row.metadata ?? {};
  const actor = nameOf(row.actor_id);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (row.is_private) return t(`activity.private.${row.entity_type}`, { actor, defaultValue: t("activity.fallback", { actor }) });

  const label = str(m.label) || str(m.title) || str(m.description) || str(m.file_name)
    || (m.category ? t(`budget.categories.${str(m.category)}`) : "");
  const role = m.role ? t(`roles.${str(m.role)}`) : "";
  const amount = m.amount != null ? formatCurrency(Number(m.amount), str(m.currency) || currency) : "";
  const vars = {
    actor, label, role, amount,
    name: m.user_id ? nameOf(str(m.user_id)) : str(m.name),
    assignee: m.assigned_to ? nameOf(str(m.assigned_to)) : "",
    from: nameOf(str(m.from)), to: nameOf(str(m.to)),
  };
  let action = row.action;
  if (row.entity_type === "packing_items" && action === "assigned" && !m.assigned_to) action = "unassigned";
  return t(`activity.${row.entity_type}.${action}`, { ...vars, defaultValue: t("activity.fallback", { actor }) });
}

export function ActivityFeed({ tripId, initial, members, userId, currency }: {
  tripId: string; initial: AuditLogRow[]; members: Member[]; userId: string; currency: string;
}) {
  const { t } = useTranslation("common");
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initial);
  const [kind, setKind] = useState<Kind>("all");
  const [, tick] = useState(0);

  // Live updates: new activity appears without a reload (RLS-filtered by Supabase Realtime).
  const live = useRealtime(`activity:${tripId}`, [{ table: "audit_logs", filter: `trip_id=eq.${tripId}`, event: "INSERT" }], () => {
    supabase.from("audit_logs").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setRows(data as AuditLogRow[]); });
  }, { debounceMs: 150 });
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 60_000); // keep "x minutes ago" fresh
    return () => clearInterval(timer);
  }, []);

  const nameOf = (uid: string | null | undefined) => {
    if (!uid) return t("activity.someone");
    if (uid === userId) return t("common.you");
    return members.find(m => m.user_id === uid)?.profiles?.display_name?.split(" ")[0] ?? t("common.traveler");
  };

  const visible = rows.filter(r => kind === "all" || KIND_OF[r.entity_type] === kind);
  const kinds: Kind[] = ["all", "itinerary", "budget", "packing", "docs", "travelers"];

  return (
    <section aria-labelledby="activity-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="activity-heading" className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {t("overview.activity")}
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive/50" />}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", live ? "bg-positive" : "bg-line-strong")} />
          </span>
        </h2>
        <span className="font-mono text-[11px] text-ink-3">{t("overview.live")}</span>
      </div>
      <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-none" role="group" aria-label={t("overview.filterActivity")}>
        {kinds.map(k => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                  className={cn("h-7 shrink-0 rounded-full px-2.5 text-[12px] transition-colors",
                                kind === k ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
            {t(`overview.kinds.${k}`)}
          </button>
        ))}
      </div>
      <div className="panel">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <Activity size={18} className="text-ink-3" aria-hidden="true" />
            <p className="mt-2 text-[13px] text-ink-2">{t("overview.noActivity")}</p>
          </div>
        ) : (
          <ol className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {visible.map(r => {
              const Icon = r.is_private ? Lock : ICON_OF[r.entity_type] ?? Activity;
              return (
                <li key={r.id} className="flex gap-3 px-4 py-3 animate-rise">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
                    <Icon size={13} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-ink">{describeActivity(r, t, nameOf, currency)}</p>
                    <p suppressHydrationWarning className="mt-0.5 font-mono text-[10.5px] text-ink-3">
                      {formatRelative(r.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
