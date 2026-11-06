import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

export function hrefWith(base: string, params: Record<string, string | number | undefined | null>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== "all" && !(k === "page" && v === 1)) q.set(k, String(v)); });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** GET search form + filter chips; state lives in the URL so views are shareable and back-button friendly. */
export function ListToolbar({ base, q, filter, filters, placeholder, extra }: {
  base: string; q: string; filter: string; filters: { id: string; label: string }[]; placeholder: string;
  extra?: Record<string, string>;
}) {
  return (
    <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
      <form action={base} method="get" className="relative flex-1 lg:max-w-sm" role="search">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder}
               className="h-9 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none" />
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      </form>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {filters.map(f => (
          <Link key={f.id} href={hrefWith(base, { q, filter: f.id, ...extra })} aria-current={filter === f.id ? "true" : undefined}
                className={cn("flex h-8 shrink-0 items-center rounded-full px-3 text-[12.5px] transition-colors",
                              filter === f.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
            {f.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ base, page, total, params, size = PAGE_SIZE }: {
  base: string; page: number; total: number; params: Record<string, string | undefined>; size?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="mt-3 font-mono text-[11.5px] text-ink-3">{total} total</p>;
  const btn = "flex h-8 items-center gap-1 rounded-[var(--radius-control)] border border-line-strong px-2.5 text-[12.5px] text-ink-2 hover:bg-sunken";
  return (
    <nav className="mt-3 flex items-center justify-between" aria-label="Pagination">
      <p className="font-mono text-[11.5px] text-ink-3">Page {page} of {pages} · {total} total</p>
      <div className="flex gap-2">
        {page > 1 && <Link className={btn} href={hrefWith(base, { ...params, page: page - 1 })}><ChevronLeft size={14} /> Prev</Link>}
        {page < pages && <Link className={btn} href={hrefWith(base, { ...params, page: page + 1 })}>Next <ChevronRight size={14} /></Link>}
      </div>
    </nav>
  );
}

export function parsePage(v?: string) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
