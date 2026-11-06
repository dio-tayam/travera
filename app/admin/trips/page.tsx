import { requireAdmin } from "@/lib/admin";
import type { AdminTripRow } from "@/types/database";
import { PageHeader } from "@/components/ui/primitives";
import { ListToolbar, PAGE_SIZE, Pagination, parsePage } from "@/components/admin/list-controls";
import { MigrationNotice } from "@/components/admin/migration-notice";
import { TripsTable } from "./trips-table";

export const metadata = { title: "Trips" };
const FILTERS = [
  { id: "all", label: "All" }, { id: "active", label: "Travelling now" }, { id: "upcoming", label: "Upcoming" },
  { id: "group", label: "Group trips" }, { id: "public", label: "Public link on" },
];

export default async function AdminTripsPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const filter = FILTERS.some(f => f.id === sp.filter) ? sp.filter! : "all";
  const page = parsePage(sp.page);
  const { data, error } = await supabase.rpc("admin_list_trips", {
    p_search: q || null, p_filter: filter, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = (data ?? []) as AdminTripRow[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Trips"
                  description="Trip metadata and counts only — itineraries, expenses, packing lists and files stay private to each trip's travelers." />
      <ListToolbar base="/admin/trips" q={q} filter={filter} filters={FILTERS} placeholder="Search title, destination or owner email" />
      {error ? <MigrationNotice message={error.message} /> : <TripsTable rows={rows} />}
      <Pagination base="/admin/trips" page={page} total={Number(rows[0]?.total_count ?? 0)} params={{ q, filter }} />
    </>
  );
}
