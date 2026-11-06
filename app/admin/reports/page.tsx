import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { cn } from "@/lib/utils";
import type { AdminReport } from "@/types/database";
import { PageHeader } from "@/components/ui/primitives";
import { MigrationNotice } from "@/components/admin/migration-notice";
import { ReportView } from "./report-view";

export const metadata = { title: "Reports" };
const RANGES = [7, 30, 90, 365];

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const { data, error } = await supabase.rpc("admin_report", { p_days: days });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Reports" description="Growth and engagement over time. Export any range as CSV."
        actions={
          <div className="flex rounded-full border border-line bg-sunken p-1" role="group" aria-label="Range">
            {RANGES.map(r => (
              <Link key={r} href={`/admin/reports?days=${r}`} aria-current={r === days ? "true" : undefined}
                    className={cn("h-8 rounded-full px-3.5 text-[13px] font-medium leading-8 transition-colors",
                                  r === days ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:text-ink")}>
                {r === 365 ? "1y" : `${r}d`}
              </Link>
            ))}
          </div>
        } />
      {error || !data ? <MigrationNotice message={error?.message} /> : <ReportView report={data as AdminReport} />}
    </>
  );
}
