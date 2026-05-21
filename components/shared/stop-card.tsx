"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Clock, MoreVertical } from "lucide-react";
import { getStopTypeColor } from "@/lib/utils";
import { StopTypeBadge } from "./stop-type-badge";
import type { Database } from "@/types/database";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Stop = Database["public"]["Tables"]["stops"]["Row"];

interface StopCardProps {
  stop: Stop;
  index: number;
  onEdit: (stop: Stop) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}

export function StopCard({ stop, index, onEdit, onDelete, readOnly }: StopCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = getStopTypeColor(stop.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-xl shadow-sm border border-gray-100 flex overflow-hidden group",
        isDragging && "shadow-md ring-2 ring-blue-200"
      )}
    >
      {/* Drag handle */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          className="flex items-center px-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* Color stripe */}
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: color }} />

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-bold flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}
                aria-label={`Stop ${index + 1}`}
              >
                {index + 1}
              </span>
              <h3
                className="font-semibold text-sm truncate"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stop.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <StopTypeBadge type={stop.type} />
              {stop.start_time && (
                <span className="flex items-center gap-1 text-xs text-gray-500" style={{ fontFamily: "var(--font-body)" }}>
                  <Clock size={11} aria-hidden="true" />
                  {stop.start_time.slice(0, 5)}
                  {stop.duration_minutes ? ` · ${stop.duration_minutes}min` : ""}
                </span>
              )}
            </div>

            {stop.address && (
              <p className="text-xs text-gray-400 mt-1 truncate" style={{ fontFamily: "var(--font-body)" }}>
                {stop.address}
              </p>
            )}
          </div>

          {/* Menu */}
          {!readOnly && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Stop options"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 animate-fade-in"
                  role="menu"
                >
                  <button
                    onClick={() => { onEdit(stop); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50"
                    style={{ fontFamily: "var(--font-body)" }}
                    role="menuitem"
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    onClick={() => { onDelete(stop.id); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600"
                    style={{ fontFamily: "var(--font-body)" }}
                    role="menuitem"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Delete
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
