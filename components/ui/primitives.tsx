import { cn } from "@/lib/utils";

/* ── Page header ─────────────────────────────────────────────────────────── */
export function PageHeader({ eyebrow, title, description, actions, className }: {
  eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode;
  actions?: React.ReactNode; className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-[34px] sm:text-[40px] text-ink text-balance">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Standard scrollable page body with consistent gutters. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn("mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10 animate-rise", className)}>
        {children}
      </div>
    </div>
  );
}

/* ── Section title ───────────────────────────────────────────────────────── */
export function SectionTitle({ children, meta, action, className }: {
  children: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
        {children}
        {meta != null && <span className="font-mono text-[12px] font-normal text-ink-3 tabular">{meta}</span>}
      </h2>
      {action}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon: React.ElementType; title: string; description?: string;
  action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("panel grid-texture flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink-2">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Progress bar ────────────────────────────────────────────────────────── */
export function Progress({ value, tone = "ink", className, label }: {
  value: number; tone?: "ink" | "accent" | "positive" | "negative"; className?: string; label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = {
    ink: "bg-ink", accent: "bg-accent", positive: "bg-positive", negative: "bg-negative",
  }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}
         role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
         aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)}
           style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */
export function Avatar({ name, src, size = 32, className }: {
  name?: string | null; src?: string | null; size?: number; className?: string;
}) {
  const initials = (name ?? "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full",
                        "bg-sunken font-medium text-ink-2 ring-1 ring-line", className)}
          style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer"
               loading="lazy" decoding="async" />
        : initials}
    </span>
  );
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
export function Badge({ children, tone = "neutral", className }: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "positive" | "negative" | "outline";
  className?: string;
}) {
  const tones = {
    neutral:  "bg-sunken text-ink-2",
    accent:   "bg-accent-soft text-accent-ink",
    positive: "bg-positive-soft text-positive",
    negative: "bg-negative-soft text-negative",
    outline:  "border border-line-strong text-ink-2",
  };
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium",
                        tones[tone], className)}>
      {children}
    </span>
  );
}

/* ── Labelled figure (boarding-pass field) ───────────────────────────────── */
export function Figure({ label, value, sub, className, valueClassName }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  className?: string; valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1.5 truncate text-[15px] font-medium text-ink tabular", valueClassName)}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-ink-3">{sub}</p>}
    </div>
  );
}
