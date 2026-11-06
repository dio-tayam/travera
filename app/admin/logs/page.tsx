import { requireAdmin } from "@/lib/admin";
import { ENTITY_FILTERS, entityLabel } from "@/lib/admin-format";
import type { AdminAuditRow } from "@/types/database";
import { PageHeader } from "@/components/ui/primitives";
import { ListToolbar, Pagination, parsePage } from "@/components/admin/list-controls";
import { MigrationNotice } from "@/components/admin/migration-notice";
import { LogsTable } from "./logs-table";

export const metadata = { title: "Activity log" };
const SIZE = 50;
const FILTERS = [{ id: "all", label: "Everything" }, ...ENTITY_FILTERS.map(e => ({ id: e, label: entityLabel(e) }))];

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const filter = FILTERS.some(f => f.id === sp.filter) ? sp.filter! : "all";
  const page = parsePage(sp.page);
  const { data, error } = await supabase.rpc("admin_list_audit", {
    p_search: q || null, p_entity: filter === "all" ? null : filter, p_limit: SIZE, p_offset: (page - 1) * SIZE,
  });
  const rows = (data ?? []) as AdminAuditRow[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Activity log"
                  description="Append-only record written by database triggers — it can't be edited from the app. Events on private items are logged without their content." />
      <ListToolbar base="/admin/logs" q={q} filter={filter} filters={FILTERS} placeholder="Search action, person or trip" />
      {error ? <MigrationNotice message={error.message} /> : <LogsTable rows={rows} />}
      <Pagination base="/admin/logs" page={page} size={SIZE} total={Number(rows[0]?.total_count ?? 0)} params={{ q, filter }} />
    </>
  );
}
