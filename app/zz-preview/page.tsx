// TEMPORARY visual check — delete before committing.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BudgetClient } from "@/app/(app)/trips/[id]/budget/budget-client";
import { PackingClient } from "@/app/(app)/trips/[id]/packing/packing-client";
import { DocumentsClient } from "@/app/(app)/trips/[id]/documents/documents-client";

const U = "u1";
const trip: any = { id: "t1", owner_id: U, title: "Spring in Tokyo", destination: "Tokyo, Japan", cover_image_url: null,
  start_date: "2026-11-20", end_date: "2026-11-27", total_budget: 60000, currency: "PHP", is_public: false, share_token: null, created_at: "" };
const prof = (id: string, n: string) => ({ id, display_name: n, avatar_url: null, home_currency: "PHP", created_at: "" });
const members: any = [
  { user_id: U, role: "owner", profiles: prof(U, "Diogenes Tayam") },
  { user_id: "u2", role: "editor", profiles: prof("u2", "Ana Reyes") },
  { user_id: "u3", role: "editor", profiles: prof("u3", "Ben Cruz") },
];
const exp = (id: string, paid: string, amount: number, category: string, description: string, date: string) =>
  ({ id, trip_id: "t1", stop_id: null, paid_by: paid, amount, currency: "PHP", category, description, date });
const expenses: any = [
  exp("e1", U, 18400, "accommodation", "Hotel Gracery, 2 nights", "2026-11-20"),
  exp("e2", "u2", 3200, "food", "Sushi dinner", "2026-11-20"),
  exp("e3", "u3", 2400, "transport", "Suica top-ups", "2026-11-21"),
  exp("e4", U, 1500, "activity", "teamLab tickets", "2026-11-22"),
  exp("e5", "u2", 9800, "shopping", "Don Quijote haul", "2026-11-22"),
];
const splits: any = expenses.flatMap((e: any) => members.map((m: any) => ({ id: e.id + m.user_id, expense_id: e.id, user_id: m.user_id, share_amount: e.amount / 3, is_settled: m.user_id === e.paid_by })));
const items: any = [["Passport", "Documents", true, U], ["Travel insurance", "Documents", false, null], ["Power bank", "Electronics", true, "u2"],
  ["Universal adapter", "Electronics", false, "u3"], ["Walking shoes", "Clothing", false, U], ["Light jacket", "Clothing", true, null], ["Sunscreen", "Toiletries", false, null]]
  .map(([label, category, is_packed, assigned_to], i) => ({ id: `p${i}`, trip_id: "t1", assigned_to, label, category, is_packed, order_index: i }));
const docs: any = [
  { id: "x1", trip_id: "t1", stop_id: null, uploaded_by: U, file_name: "PR432-boarding-pass.pdf", storage_path: "t1/u1/1762300000000_PR432-boarding-pass.pdf", type: "flight" },
  { id: "x2", trip_id: "t1", stop_id: null, uploaded_by: "u2", file_name: "hotel-gracery-confirmation.pdf", storage_path: "t1/u2/1762400000000_hotel.pdf", type: "hotel" },
  { id: "x3", trip_id: "t1", stop_id: null, uploaded_by: "u3", file_name: "itinerary-notes.pdf", storage_path: "t1/u3/1762500000000_notes.pdf", type: "other" },
];

export default async function P({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  return (
    <div className="h-dvh">
      {v === "packing" ? <PackingClient trip={trip} initialItems={items} members={members} userId={U} canEdit />
        : v === "docs" ? <DocumentsClient trip={trip} initialDocs={docs} members={members} userId={U} canEdit />
        : <BudgetClient trip={trip} members={members} initialExpenses={expenses} initialSplits={splits} userId={U} canEdit />}
    </div>
  );
}
