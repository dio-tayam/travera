"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock, MoreVertical, MapPin } from "lucide-react";
import { getStopTypeColor } from "@/lib/utils";
import type { Database } from "@/types/database";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

const TYPE_EMOJI: Record<string, string> = {
  hotel: "🏨", activity: "🎯", restaurant: "🍜",
  transit: "🚌", flight: "✈️", free: "🌿",
};

interface StopCardProps {
  stop: Stop; index: number;
  onEdit: (stop: Stop) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export function StopCard({ stop, index, onEdit, onDelete, readOnly }: StopCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id, disabled: readOnly });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const color = getStopTypeColor(stop.type);

  return (
    <div ref={setNodeRef} style={style}
         className={cn(
           "bg-white rounded-2xl border flex overflow-hidden transition-all duration-150",
           isDragging
             ? "shadow-xl ring-2 ring-indigo-200 border-indigo-100"
             : "border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
         )}>

      {/* Drag handle */}
      {!readOnly && (
        <div {...attributes} {...listeners}
             className="flex items-center px-2 cursor-grab active:cursor-grabbing
                        text-slate-200 hover:text-slate-400 transition-colors">
          <GripVertical size={14}/>
        </div>
      )}

      {/* Left color stripe */}
      <div className="w-[3px] shrink-0" style={{ backgroundColor: color }}/>

      {/* Content */}
      <div className="flex-1 p-3.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full text-white text-[10px] flex items-center
                               justify-center font-bold shrink-0"
                    style={{ backgroundColor: color }}
                    aria-label={`Stop ${index + 1}`}>
                {index + 1}
              </span>
              <span className="text-sm">{TYPE_EMOJI[stop.type] ?? "📍"}</span>
              <h3 className="font-semibold text-slate-900 text-sm truncate"
                  style={{ fontFamily: "var(--font-heading)" }}>
                {stop.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 ml-7">
              {stop.start_time && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={11}/> {stop.start_time.slice(0, 5)}
                  {stop.duration_minutes ? ` · ${stop.duration_minutes}min` : ""}
                </span>
              )}
              {stop.address && (
                <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-48">
                  <MapPin size={10}/> {stop.address}
                </span>
              )}
            </div>
          </div>

          {/* Menu */}
          {!readOnly && (
            <div className="relative shrink-0">
              <button onClick={() => setMenuOpen(o => !o)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600
                                 hover:bg-slate-100 transition-colors"
                      aria-label="Stop options" aria-expanded={menuOpen}>
                <MoreVertical size={14}/>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl
                                shadow-lg border border-slate-100 py-1 z-10 animate-scale-in"
                     role="menu">
                  <button onClick={() => { onEdit(stop); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm
                                     text-slate-700 hover:bg-slate-50 text-left transition-colors"
                          role="menuitem">
                    <Pencil size={13}/> Edit
                  </button>
                  <button onClick={() => { onDelete(stop.id); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm
                                     text-red-500 hover:bg-red-50 text-left transition-colors"
                          role="menuitem">
                    <Trash2 size={13}/> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
