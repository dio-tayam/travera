"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  id: T; label: React.ReactNode; icon?: React.ElementType; count?: number; hint?: string;
};

/** Pill-style tab switcher (e.g. Group / Mine). Keyboard: arrow keys move between options. */
export function Segmented<T extends string>({ options, value, onChange, className, label }: {
  options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; className?: string; label: string;
}) {
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.id);
    (e.currentTarget.parentElement?.querySelector(`[data-id="${next.id}"]`) as HTMLElement | null)?.focus();
  }
  return (
    <div role="tablist" aria-label={label}
         className={cn("inline-flex rounded-full border border-line bg-sunken p-1", className)}>
      {options.map((o, i) => {
        const active = o.id === value;
        const Icon = o.icon;
        return (
          <button key={o.id} role="tab" type="button" data-id={o.id} aria-selected={active} tabIndex={active ? 0 : -1}
                  title={o.hint} onClick={() => onChange(o.id)} onKeyDown={e => onKey(e, i)}
                  className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                                active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(22_24_29/0.12),0_0_0_1px_var(--color-line)]"
                                       : "text-ink-2 hover:text-ink")}>
            {Icon && <Icon size={14} aria-hidden="true" />}
            {o.label}
            {o.count != null && (
              <span className={cn("font-mono text-[11px]", active ? "text-ink-3" : "text-ink-3/80")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
