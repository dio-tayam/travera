"use client";

import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, disabled, label, className }: {
  checked: boolean; onChange: () => void; disabled?: boolean; label: string; className?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled}
            className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
                          checked ? "bg-ink" : "bg-line-strong", className)}>
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          checked && "translate-x-4 rtl:-translate-x-4")} />
    </button>
  );
}
