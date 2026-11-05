"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import { useEffect, useRef } from "react";
import { GripVertical, MapPin, MapPinOff, MoreHorizontal, Pencil, Plane, Trash2 } from "lucide-react";
import { STOP_META } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface StopCardProps {
  stop: Stop;
  index: number;
  onEdit?: (stop: Stop) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  /** Highlighted because its pin is selected on the map. */
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** Travel to the next stop, e.g. { label: "12 min walk · 900 m", estimated: false }. */
  legToNext?: { label: string; estimated: boolean; flight?: boolean } | null;
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** One stop on the day timeline. */
export function StopCard({ stop, index, onEdit, onDelete, readOnly, selected, onSelect, legToNext }: StopCardProps) {
  const { t } = useTranslation("common");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id, disabled: readOnly });
  const meta = STOP_META[stop.type] ?? STOP_META.activity;
  const Icon = meta.icon;
  const panelRef = useRef<HTMLDivElement>(null);
  const hasLocation = stop.lat != null && stop.lng != null;

  // When the stop is picked on the map, bring its card into view.
  useEffect(() => {
    if (selected) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <li ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(
          "relative flex gap-3 pb-3 last:pb-0",
          // timeline rail
          "before:absolute before:left-[15px] before:top-9 before:bottom-0 before:w-px before:bg-line last:before:hidden",
          isDragging && "z-10"
        )}>
      <span className="relative z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] font-mono text-[11px] font-medium transition-colors"
            style={selected ? { borderColor: meta.color, background: meta.color, color: "#fff" } : { borderColor: meta.color, color: meta.color, background: "var(--color-surface)" }}
            aria-label={`Stop ${index + 1}`}>
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
      <div ref={panelRef}
           onClick={e => { if (!(e.target as HTMLElement).closest("button,a")) onSelect?.(stop.id); }}
           className={cn("panel px-4 py-3 transition-[box-shadow,border-color]",
                         onSelect && "cursor-pointer hover:border-line-strong",
                         selected && "border-ink shadow-[0_0_0_1px_var(--color-ink)]",
                         isDragging && "shadow-[0_16px_40px_-16px_rgb(22_24_29/0.35)]")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
              <span className="inline-flex items-center gap-1 font-medium" style={{ color: meta.color }}>
                <Icon size={12} aria-hidden="true" /> {t(`itinerary.stopTypes.${stop.type}`)}
              </span>
              {stop.start_time && (
                <span className="font-mono text-ink-3">
                  {stop.start_time.slice(0, 5)}
                  {stop.duration_minutes ? ` · ${formatDuration(stop.duration_minutes)}` : ""}
                </span>
              )}
            </p>
            <h3 className="mt-1 text-[14.5px] font-medium leading-snug text-ink">{stop.title}</h3>
            {stop.address && (
              <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-ink-3">
                <MapPin size={12} className="mt-[3px] shrink-0" aria-hidden="true" />
                <span className="line-clamp-1">{stop.address}</span>
              </p>
            )}
            {!hasLocation && !readOnly && (
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-warning">
                <MapPinOff size={12} aria-hidden="true" /> Not on the map — edit to add a location
              </p>
            )}
            {stop.notes && <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-2">{stop.notes}</p>}
          </div>

          {!readOnly && (
            <div className="-mr-2 -mt-1 flex shrink-0 items-center">
              <Menu.Root>
                <Menu.Trigger aria-label={`Options for ${stop.title}`}
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-sunken hover:text-ink data-[state=open]:bg-sunken">
                  <MoreHorizontal size={16} />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={4}
                                className="z-50 min-w-[150px] rounded-[12px] border border-line bg-surface p-1 shadow-[0_16px_40px_-16px_rgb(22_24_29/0.3)] animate-rise">
                    <Menu.Item onSelect={() => onEdit?.(stop)}
                               className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-sunken">
                      <Pencil size={14} /> {t("common.edit")}
                    </Menu.Item>
                    <Menu.Item onSelect={() => onDelete?.(stop.id)}
                               className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] text-negative outline-none data-[highlighted]:bg-negative-soft">
                      <Trash2 size={14} /> {t("common.delete")}
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
              <button ref={setActivatorNodeRef} {...attributes} {...listeners}
                      aria-label={`Reorder ${stop.title}`}
                      className="grid h-8 w-6 cursor-grab touch-none place-items-center rounded-md text-ink-3 hover:text-ink active:cursor-grabbing">
                <GripVertical size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
      {legToNext && (
        <p className={cn("mt-2 flex items-center gap-1.5 pl-1 font-mono text-[11px]", legToNext.flight ? "text-accent-ink" : "text-ink-3")}
           title={legToNext.flight ? "Too far to travel by road — estimated as a flight" : legToNext.estimated ? "Straight-line estimate" : "Route from OpenStreetMap"}>
          {legToNext.flight
            ? <><Plane size={11} className="rotate-90" aria-hidden="true" /> Flight ≈ {legToNext.label}</>
            : <><span aria-hidden="true">↓</span> {legToNext.estimated && "≈ "}{legToNext.label}</>}
        </p>
      )}
      </div>
    </li>
  );
}
