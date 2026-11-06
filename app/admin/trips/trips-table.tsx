"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Globe2, Lock } from "lucide-react";
import { cn, formatCompactRange, formatDate } from "@/lib/utils";
import type { AdminTripRow } from "@/types/database";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { unpublishTrip } from "../actions";

export function TripsTable({ rows }: { rows: AdminTripRow[] }) {
  const [pending, start] = useTransition();
  if (!rows.length) return <p className="panel mt-4 px-5 py-10 text-center text-[13px] text-ink-3">No trips match.</p>;

  return (
    <div className={cn("panel mt-4 overflow-x-auto", pending && "opacity-70")}>
      <table className="w-full min-w-[820px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            <th className="px-4 py-2.5 font-medium">Trip</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Dates</th>
            <th className="px-3 py-2.5 text-right font-medium">Travelers</th>
            <th className="px-3 py-2.5 text-right font-medium">Stops · Exp · Docs</th>
            <th className="px-3 py-2.5 font-medium">Sharing</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(t => (
            <tr key={t.id}>
              <td className="px-4 py-3">
                <p className="max-w-[240px] truncate font-medium text-ink">{t.title}</p>
                <p className="max-w-[240px] truncate text-[12px] text-ink-3">{t.destination ?? "—"} · created {formatDate(t.created_at)}</p>
              </td>
              <td className="px-3 py-3">
                <p className="max-w-[180px] truncate text-ink">{t.owner_name ?? "—"}</p>
                <p className="max-w-[180px] truncate font-mono text-[11.5px] text-ink-3">{t.owner_email}</p>
              </td>
              <td className="px-3 py-3 text-ink-2">{t.start_date ? formatCompactRange(t.start_date, t.end_date) : "—"}</td>
              <td className="px-3 py-3 text-right font-mono tabular text-ink">{t.member_count}</td>
              <td className="px-3 py-3 text-right font-mono tabular text-ink-2">{t.stop_count} · {t.expense_count} · {t.document_count}</td>
              <td className="px-3 py-3">
                {t.is_public ? (
                  <div className="flex items-center gap-2">
                    <Badge tone="accent"><Globe2 size={11} /> Public</Badge>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled={pending}
                            onClick={() => {
                              if (!window.confirm(`Take the public link for “${t.title}” offline?`)) return;
                              start(async () => {
                                const r = await unpublishTrip(t.id);
                                if (r.ok) toast.success("Public link disabled"); else toast.error(r.error);
                              });
                            }}>
                      Unpublish
                    </Button>
                  </div>
                ) : <Badge tone="outline"><Lock size={11} /> Private</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
