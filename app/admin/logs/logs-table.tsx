"use client";

import { Fragment, useState } from "react";
import { ChevronRight, Download, Lock } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { adminEventSummary, entityLabel } from "@/lib/admin-format";
import type { AdminAuditRow } from "@/types/database";
import { Button } from "@/components/ui/button";

export function LogsTable({ rows }: { rows: AdminAuditRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = ["time", "actor", "actor_email", "action", "entity", "summary", "trip", "private"];
    const lines = rows.map(r => [r.created_at, r.actor_name, r.actor_email, r.action, r.entity_type, adminEventSummary(r), r.trip_title, r.is_private].map(esc).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `travera-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!rows.length) return <p className="panel mt-4 px-5 py-10 text-center text-[13px] text-ink-3">No events match.</p>;

  return (
    <>
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="secondary" onClick={exportCsv}><Download size={14} /> Export this page</Button>
      </div>
      <div className="panel mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">Who</th>
              <th className="px-3 py-2.5 font-medium">What</th>
              <th className="px-3 py-2.5 font-medium">Trip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const expanded = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={cn("cursor-pointer border-t border-line hover:bg-paper", expanded && "bg-paper")}
                      onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                    <td className="px-2 py-2.5 text-ink-3"><ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-ink-2">{formatDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <p className="max-w-[180px] truncate text-ink">{r.actor_name ?? (r.actor_id ? "—" : "System")}</p>
                      {r.actor_email && <p className="max-w-[180px] truncate font-mono text-[11px] text-ink-3">{r.actor_email}</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="me-2 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2">{entityLabel(r.entity_type)}</span>
                      {r.is_private && <Lock size={11} className="me-1 inline -translate-y-px text-ink-3" aria-label="Private item" />}
                      <span className="text-ink">{adminEventSummary(r)}</span>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-ink-2">{r.trip_title ?? "—"}</td>
                  </tr>
                  {expanded && (
                    <tr className="bg-paper">
                      <td />
                      <td colSpan={4} className="px-3 pb-3">
                        <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px]">
                          <dt className="text-ink-3">event id</dt><dd className="text-ink-2">{r.id}</dd>
                          <dt className="text-ink-3">action</dt><dd className="text-ink-2">{r.entity_type}.{r.action}</dd>
                          {r.entity_id && <><dt className="text-ink-3">entity id</dt><dd className="text-ink-2">{r.entity_id}</dd></>}
                          {r.trip_id && <><dt className="text-ink-3">trip id</dt><dd className="text-ink-2">{r.trip_id}</dd></>}
                          <dt className="text-ink-3">details</dt>
                          <dd><pre className="whitespace-pre-wrap break-all text-ink-2">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata, null, 2) : "—"}</pre></dd>
                        </dl>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
