import type { AdminAuditRow } from "@/types/database";

const ENTITY: Record<string, string> = {
  trips: "Trip", trip_members: "Traveler", stops: "Stop", expenses: "Expense", expense_splits: "Settlement",
  packing_items: "Packing item", documents: "Document", auth: "Account", user: "User",
};

export const ENTITY_FILTERS = ["auth", "user", "trips", "trip_members", "stops", "expenses", "expense_splits", "packing_items", "documents"];
export const entityLabel = (e: string) => ENTITY[e] ?? e;

/** English one-liner for an audit row (admin console is English-only). Private rows carry no content. */
export function adminEventSummary(r: Pick<AdminAuditRow, "action" | "entity_type" | "metadata" | "is_private">): string {
  const m = r.metadata ?? {};
  const s = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : "");
  const thing = s("title") || s("label") || s("description") || s("file_name") || s("category");
  if (r.is_private) return `${r.action} a private ${entityLabel(r.entity_type).toLowerCase()} (content hidden)`;
  switch (`${r.entity_type}.${r.action}`) {
    case "auth.signed_up": return "Created an account";
    case "auth.signed_in": return "Signed in";
    case "user.admin_granted": return "Granted admin access";
    case "user.admin_revoked": return "Revoked admin access";
    case "user.suspended": return `Suspended a user${s("reason") ? ` — “${s("reason")}”` : ""}`;
    case "user.unsuspended": return "Lifted a suspension";
    case "trips.shared_publicly": return "Turned on the public link";
    case "trips.made_private": return "Turned off the public link";
    case "trips.admin_unpublished": return "Admin took the public link offline";
    case "trip_members.joined": return `${s("name") || "A traveler"} joined as ${s("role")}`;
    case "trip_members.left": return `${s("name") || "A traveler"} left / was removed`;
    case "trip_members.role_changed": return `${s("name") || "A traveler"}: ${s("from")} → ${s("role")}`;
    case "expense_splits.settled": return `Settled ${m.amount ?? ""}`;
  }
  return `${r.action.replace(/_/g, " ")} ${entityLabel(r.entity_type).toLowerCase()}${thing ? ` “${thing}”` : ""}`;
}
