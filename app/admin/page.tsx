import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { adminEventSummary, entityLabel } from "@/lib/admin-format";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/utils";
import type { AdminAuditRow, AdminOverview } from "@/types/database";
import { BarList, DailyBars, Stat } from "@/components/admin/charts";
import { PageHeader, SectionTitle } from "@/components/ui/primitives";
import { MigrationNotice } from "@/components/admin/migration-notice";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();
  const [{ data: overview, error }, { data: recent }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_list_audit", { p_limit: 8 }),
  ]);
  if (error || !overview) return <MigrationNotice message={error?.message} />;
  const o = overview as AdminOverview;
  const pctPacked = o.packing_items ? Math.round((o.packing_packed / o.packing_items) * 100) : 0;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview" description="Live numbers across every account. Private content (personal expenses, packing and documents) is only ever counted, never shown." />

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-4">
        <Stat label="Users" value={formatNumber(o.users)} sub={`+${o.users_7d} this week · +${o.users_30d} in 30 days`} />
        <Stat label="Active (7d)" value={formatNumber(o.active_7d)} sub={`${formatNumber(o.active_30d)} in 30 days`} tone="accent" />
        <Stat label="Trips" value={formatNumber(o.trips)} sub={`+${o.trips_7d} this week · ${o.trips_group} group trips`} />
        <Stat label="Travelling now" value={formatNumber(o.trips_active)} sub={`${o.trips_upcoming} upcoming`} tone="positive" />
        <Stat label="Expenses" value={formatNumber(o.expenses)} sub={`${o.expenses_personal} personal (private)`} />
        <Stat label="Packing items" value={formatNumber(o.packing_items)} sub={`${pctPacked}% packed`} />
        <Stat label="Documents" value={formatNumber(o.documents)} sub={`${o.documents_private} private · ${formatBytes(o.storage_bytes)}`} />
        <Stat label="Public links" value={formatNumber(o.trips_public)} sub={`${o.invitations} pending invites`} />
      </dl>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="panel px-5 py-5">
          <SectionTitle meta={`${o.signups_daily.reduce((s, d) => s + d.n, 0)} in 30d`}>Sign-ups</SectionTitle>
          <DailyBars data={o.signups_daily} label="Sign-ups per day" />
        </section>
        <section className="panel px-5 py-5">
          <SectionTitle meta={`${o.trips_daily.reduce((s, d) => s + d.n, 0)} in 30d`}>Trips created</SectionTitle>
          <DailyBars data={o.trips_daily} label="Trips created per day" />
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="panel px-5 py-5">
          <SectionTitle>Top destinations</SectionTitle>
          <BarList items={o.top_destinations.map(d => ({ label: d.name, n: d.n }))} />
        </section>
        <section className="panel px-5 py-5">
          <SectionTitle meta={formatNumber(o.memberships)}>Trip roles</SectionTitle>
          <BarList items={(["owner", "editor", "viewer"] as const).map((r, i) => ({
            label: r[0].toUpperCase() + r.slice(1), n: o.roles[r] ?? 0, color: ["var(--color-accent)", "var(--color-ink)", "var(--color-ink-3)"][i],
          }))} />
        </section>
        <section className="panel px-5 py-5">
          <SectionTitle>Group spending by currency</SectionTitle>
          <BarList items={o.spend_by_currency.map(c => ({ label: `${c.currency} · ${formatNumber(c.total, { maximumFractionDigits: 0 })}`, n: c.count }))}
                   empty="No group expenses yet." />
          <p className="mt-3 text-[11.5px] text-ink-3">Bars show number of expenses. Personal expenses are excluded.</p>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <SectionTitle action={<Link href="/admin/logs" className="flex items-center gap-1 text-[13px] text-ink-2 hover:text-ink">Full log <ArrowRight size={13} /></Link>}>
            Latest activity <span className="font-mono text-[12px] font-normal text-ink-3">{o.events_24h} in 24h</span>
          </SectionTitle>
          <ul className="panel divide-y divide-line">
            {((recent ?? []) as AdminAuditRow[]).map(r => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                {r.is_private && <Lock size={12} className="shrink-0 text-ink-3" aria-label="Private" />}
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium text-ink">{r.actor_name ?? r.actor_email ?? "System"}</span>{" "}
                  <span className="text-ink-2">{adminEventSummary(r)}</span>
                  {r.trip_title && <span className="text-ink-3"> · {r.trip_title}</span>}
                </span>
                <span className="hidden shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-2 sm:inline">{entityLabel(r.entity_type)}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-3">{formatDateTime(r.created_at)}</span>
              </li>
            ))}
            {!recent?.length && <li className="px-4 py-6 text-center text-[13px] text-ink-3">No activity recorded yet.</li>}
          </ul>
        </section>
        <section className="panel space-y-3 px-5 py-5">
          <SectionTitle>Moderation</SectionTitle>
          <p className="flex items-center justify-between text-[13px]"><span className="text-ink-2">Admins</span><span className="font-mono text-ink">{o.admins}</span></p>
          <p className="flex items-center justify-between text-[13px]"><span className="text-ink-2">Suspended users</span><span className="font-mono text-ink">{o.suspended}</span></p>
          <p className="flex items-center justify-between text-[13px]"><span className="text-ink-2">Itinerary stops</span><span className="font-mono text-ink">{formatNumber(o.stops)}</span></p>
          <p className="flex gap-2 border-t border-line pt-3 text-[12px] text-ink-3"><ShieldCheck size={14} className="shrink-0" /> Admin actions are recorded in the activity log.</p>
        </section>
      </div>
    </>
  );
}
