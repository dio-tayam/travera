"use client";

import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, formatDate, formatWeekday, parseDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];

/** Horizontal day selector — weekday + date chips, ink when active. */
export function DayStrip({ days, selected, onSelect, onAdd, adding, className }: {
  days: Day[]; selected: string | null; onSelect: (id: string) => void;
  onAdd?: () => void; adding?: boolean; className?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-none", className)} role="tablist" aria-label={t("itinerary.days")}>
      {days.map((d, i) => {
        const active = d.id === selected;
        const date = d.date ? parseDate(d.date) : null;
        return (
          <button key={d.id} role="tab" aria-selected={active} onClick={() => onSelect(d.id)}
                  aria-label={`${t("itinerary.day", { number: i + 1 })}${date ? `, ${formatDate(date)}` : ""}`}
                  className={cn(
                    "flex h-[60px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[12px] border transition-colors",
                    active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-line-strong"
                  )}>
            <span suppressHydrationWarning className={cn("font-mono text-[9.5px] uppercase tracking-[0.12em]", active ? "text-paper/60" : "text-ink-3")}>
              {date ? formatWeekday(date) : t("itinerary.dayShort")}
            </span>
            <span className="display text-[22px] leading-none">{date ? date.getDate() : i + 1}</span>
          </button>
        );
      })}
      {onAdd && (
        <button onClick={onAdd} disabled={adding} aria-label={t("itinerary.addDay")}
                className="grid h-[60px] w-[54px] shrink-0 place-items-center rounded-[12px] border border-dashed border-line-strong text-ink-3 transition-colors hover:border-ink hover:text-ink disabled:opacity-50">
          <Plus size={18} />
        </button>
      )}
    </div>
  );
}
