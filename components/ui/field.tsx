import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase = [
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface text-ink text-sm",
  "placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150",
  "hover:border-ink-3 focus:outline-none focus:border-ink focus:ring-3 focus:ring-ink/8",
  "disabled:opacity-60 disabled:cursor-not-allowed",
].join(" ");

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(controlBase, "h-10 px-3", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, "px-3 py-2.5 resize-none", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, "h-10 pl-3 pr-9 appearance-none", className)} {...props}>
        {children}
      </select>
      <ChevronDown size={15} aria-hidden="true"
                   className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  )
);
Select.displayName = "Select";

export function Field({ label, htmlFor, hint, optional, children, className }: {
  label: string; htmlFor?: string; hint?: string; optional?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-[13px] font-medium text-ink">
        <span>{label}</span>
        {optional && <span className="text-[12px] font-normal text-ink-3">Optional</span>}
      </label>
      {children}
      {hint && <p className="text-[12px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-control)] bg-negative-soft px-3 py-2.5 text-[13px] text-negative">
      {children}
    </p>
  );
}
