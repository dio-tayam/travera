"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn, formatDate, formatWeekday, parseDate } from "@/lib/utils";
import type { Database } from "@/types/database";

type Day = Database["public"]["Tables"]["itinerary_days"]["Row"];

/** Wrapping day selector — weekday + date chips, ink when active. */
export function DayStrip({ days, selected, onSelect, onAdd, onRemove, adding, className }: {
  days: Day[]; selected: string | null; onSelect: (id: string) => void;
  onAdd?: () => void; onRemove?: (id: string) => void; adding?: boolean; className?: string;
}) {
  const { t } = useTranslation("common");
  const stripRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const [expanded, setExpanded] = useState(false);
  const hasAdd = Boolean(onAdd);
  const hasRemove = Boolean(onRemove);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    const updateVisibleCount = () => {
      const style = window.getComputedStyle(strip);
      const width = strip.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap) || 8;
      const chipWidth = 54;
      const controlWidth = (hasAdd ? 54 : 0) + (hasRemove ? 54 : 0);
      const columns = Math.max(1, Math.floor((width + gap) / (chipWidth + gap)));
      const secondRowDays = Math.max(0, Math.floor((width - controlWidth - gap) / (chipWidth + gap)));
      setVisibleCount(columns + secondRowDays);
    };

    updateVisibleCount();
    const observer = new ResizeObserver(updateVisibleCount);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [hasAdd, hasRemove]);

  useEffect(() => {
    if (days.length <= visibleCount) setExpanded(false);
  }, [days.length, visibleCount]);

  const showToggle = days.length > visibleCount;
  const selectedIndex = days.findIndex(d => d.id === selected);
  const visibleDays = expanded || !showToggle
    ? days.map((day, index) => ({ day, index }))
    : selectedIndex >= visibleCount
      ? [...days.slice(0, visibleCount - 1).map((day, index) => ({ day, index })), { day: days[selectedIndex], index: selectedIndex }]
      : days.slice(0, visibleCount).map((day, index) => ({ day, index }));
  return (
    <div ref={stripRef} className={cn(className)}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("itinerary.days")}>
        {visibleDays.map(({ day: d, index }) => {
          const active = d.id === selected;
          const date = d.date ? parseDate(d.date) : null;
          return (
            <button key={d.id} role="tab" aria-selected={active} onClick={() => onSelect(d.id)}
                    aria-label={`${t("itinerary.day", { number: index + 1 })}${date ? `, ${formatDate(date)}` : ""}`}
                    className={cn(
                      "flex h-[60px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[12px] border transition-colors",
                      active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-line-strong"
                    )}>
              <span suppressHydrationWarning className={cn("font-mono text-[9.5px] uppercase tracking-[0.12em]", active ? "text-paper/60" : "text-ink-3")}>
                {date ? formatWeekday(date) : t("itinerary.dayShort")}
              </span>
              <span className="display text-[22px] leading-none">{date ? date.getDate() : index + 1}</span>
            </button>
          );
        })}
        {onAdd && (
          <button type="button" onClick={onAdd} disabled={adding} aria-label={t("itinerary.addDay")} title={t("itinerary.addDay")}
                  className="grid h-[60px] w-[54px] shrink-0 place-items-center rounded-[12px] border border-dashed border-line-strong text-ink-3 transition-colors hover:border-ink hover:text-ink disabled:opacity-50">
            <Plus size={18} />
          </button>
        )}
        {onRemove && selected && (
          <button type="button" onClick={() => onRemove(selected)} aria-label={t("itinerary.removeSelectedDay", { day: selectedIndex + 1 })}
                  title={t("itinerary.removeDay")} className="grid h-[60px] w-[54px] shrink-0 place-items-center rounded-[12px] border border-dashed border-line text-ink-3 transition-colors hover:border-negative hover:text-negative">
            <Trash2 size={17} aria-hidden="true" />
          </button>
        )}
      </div>
      {showToggle && (
        <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}
                aria-label={expanded ? t("itinerary.showLess") : t("itinerary.showMore")}
                title={expanded ? t("itinerary.showLess") : t("itinerary.showMore")}
                className="mx-auto mt-1 grid h-6 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-ink">
          {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
