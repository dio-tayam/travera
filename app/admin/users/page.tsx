import { requireAdmin } from "@/lib/admin";
import type { AdminUserRow } from "@/types/database";
import { PageHeader } from "@/components/ui/primitives";
import { ListToolbar, PAGE_SIZE, Pagination, parsePage } from "@/components/admin/list-controls";
import { MigrationNotice } from "@/components/admin/migration-notice";
import { UsersTable } from "./users-table";

export const metadata = { title: "Users" };
const FILTERS = [
  { id: "all", label: "All" }, { id: "admins", label: "Admins" },
  { id: "suspended", label: "Suspended" }, { id: "inactive", label: "Inactive 30d+" },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const filter = FILTERS.some(f => f.id === sp.filter) ? sp.filter! : "all";
  const page = parsePage(sp.page);
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: q || null, p_filter: filter, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  });
  const rows = (data ?? []) as AdminUserRow[];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users" description="Accounts, their trips and access. Suspended users are signed out of all trip data by row-level security." />
      <ListToolbar base="/admin/users" q={q} filter={filter} filters={FILTERS} placeholder="Search name or email" />
      {error ? <MigrationNotice message={error.message} /> : <UsersTable rows={rows} me={user.id} />}
      <Pagination base="/admin/users" page={page} total={Number(rows[0]?.total_count ?? 0)} params={{ q, filter }} />
    </>
  );
}
