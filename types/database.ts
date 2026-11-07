export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Explicit row shapes ────────────────────────────────────────────────────

export type Role = "owner" | "editor" | "viewer";
/** Group content is shared with every traveler; personal/private content is visible only to its creator. */
export type Scope = "group" | "personal";
export type Visibility = "group" | "private";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  home_currency: string;
  created_at: string;
};

export type TripRow = {
  id: string;
  owner_id: string;
  title: string;
  destination: string | null;
  cover_image_url: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  currency: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
};

export type TripMemberRow = {
  id: string;
  trip_id: string;
  user_id: string;
  role: Role;
};

export type TripInvitationRow = {
  id: string;
  trip_id: string;
  email: string;
  role: "editor" | "viewer";
  invited_by: string;
  created_at: string;
};

export type ItineraryDayRow = {
  id: string;
  trip_id: string;
  day_number: number;
  date: string | null;
  notes: string | null;
};

export type StopRow = {
  id: string;
  day_id: string;
  trip_id: string;
  order_index: number;
  type: "hotel" | "activity" | "restaurant" | "transit" | "flight" | "free";
  title: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
};

export type ExpenseRow = {
  id: string;
  trip_id: string;
  stop_id: string | null;
  paid_by: string;
  amount: number;
  currency: string;
  category: "food" | "accommodation" | "transport" | "activity" | "shopping" | "other";
  description: string | null;
  date: string;
  scope: Scope;
  created_by: string | null;
  created_at: string;
};

export type ExpenseSplitRow = {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  is_settled: boolean;
};

export type MemberBudgetRow = {
  trip_id: string;
  user_id: string;
  amount: number;
  updated_at: string;
};

export type PackingItemRow = {
  id: string;
  trip_id: string;
  assigned_to: string | null;
  label: string;
  category: string;
  is_packed: boolean;
  order_index: number;
  scope: Scope;
  created_by: string | null;
  created_at: string;
};

export type DocumentRow = {
  id: string;
  trip_id: string;
  stop_id: string | null;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  type: "flight" | "hotel" | "visa" | "other";
  visibility: Visibility;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  trip_id: string | null;
  is_private: boolean;
  metadata: Record<string, Json>;
};

// ── Admin RPC shapes ───────────────────────────────────────────────────────

export type DailyPoint = { day: string; n: number };

export type AdminOverview = {
  users: number; users_7d: number; users_30d: number; active_7d: number; active_30d: number;
  trips: number; trips_7d: number; trips_public: number; trips_active: number; trips_upcoming: number;
  trips_group: number; memberships: number; roles: Partial<Record<Role, number>>;
  stops: number; expenses: number; expenses_personal: number;
  spend_by_currency: { currency: string; total: number; count: number }[];
  packing_items: number; packing_packed: number;
  documents: number; documents_private: number; storage_bytes: number;
  invitations: number; suspended: number; admins: number; events_24h: number;
  signups_daily: DailyPoint[]; trips_daily: DailyPoint[];
  top_destinations: { name: string; n: number }[];
};

export type AdminReport = {
  days: number;
  daily: { day: string; signups: number; active: number; trips: number; expenses: number;
           documents: number; packing: number; events: number }[];
  expense_categories: { category: string; n: number }[];
  document_types: { type: string; n: number }[];
  group_sizes: { size: number; n: number }[];
};

export type AdminUserRow = {
  id: string; email: string | null; display_name: string | null; avatar_url: string | null;
  created_at: string; last_sign_in_at: string | null; trip_count: number; owned_count: number;
  is_admin: boolean; is_suspended: boolean; suspension_reason: string | null; total_count: number;
};

export type AdminTripRow = {
  id: string; title: string; destination: string | null; owner_id: string; owner_name: string | null;
  owner_email: string | null; member_count: number; is_public: boolean; start_date: string | null;
  end_date: string | null; created_at: string; stop_count: number; expense_count: number;
  document_count: number; total_count: number;
};

export type AdminAuditRow = {
  id: string; created_at: string; actor_id: string | null; actor_name: string | null; actor_email: string | null;
  action: string; entity_type: string; entity_id: string | null; trip_id: string | null; trip_title: string | null;
  is_private: boolean; metadata: Record<string, Json>; total_count: number;
};

export type SharedTrip = {
  trip: Pick<TripRow, "id" | "title" | "destination" | "cover_image_url" | "start_date" | "end_date">;
  owner: Pick<ProfileRow, "display_name" | "avatar_url"> | null;
  days: ItineraryDayRow[];
  stops: StopRow[];
};

// ── Database interface ─────────────────────────────────────────────────────
// Uses the `{ [_ in never]: never }` empty-map pattern that satisfies
// Supabase's GenericSchema index constraints without introducing `never`
// values in the table rows.

type Table<Row, Insert, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Opt<ProfileRow, "created_at">, Partial<Omit<ProfileRow, "id" | "created_at">>>;
      trips: Table<TripRow, Opt<Omit<TripRow, "id">, "created_at">, Partial<Omit<TripRow, "id" | "created_at" | "owner_id">>>;
      trip_members: Table<TripMemberRow, Omit<TripMemberRow, "id">, Partial<Pick<TripMemberRow, "role">>>;
      trip_invitations: Table<TripInvitationRow, Opt<TripInvitationRow, "id" | "role" | "created_at">,
        Partial<Pick<TripInvitationRow, "email" | "role">>>;
      itinerary_days: Table<ItineraryDayRow, Omit<ItineraryDayRow, "id">>;
      stops: Table<StopRow, Omit<StopRow, "id">>;
      expenses: Table<ExpenseRow, Opt<Omit<ExpenseRow, "id">, "scope" | "created_by" | "created_at">,
        Partial<Omit<ExpenseRow, "id" | "trip_id" | "created_by" | "created_at">>>;
      expense_splits: Table<ExpenseSplitRow, Omit<ExpenseSplitRow, "id">>;
      member_budgets: Table<MemberBudgetRow, Opt<MemberBudgetRow, "updated_at">>;
      packing_items: Table<PackingItemRow, Opt<Omit<PackingItemRow, "id">, "scope" | "created_by" | "created_at">,
        Partial<Omit<PackingItemRow, "id" | "trip_id" | "created_by" | "created_at">>>;
      documents: Table<DocumentRow, Opt<Omit<DocumentRow, "id">, "visibility" | "created_at">,
        Partial<Pick<DocumentRow, "file_name" | "type" | "visibility" | "stop_id">>>;
      audit_logs: Table<AuditLogRow, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      add_trip_member_by_email: {
        Args: { p_trip_id: string; p_email: string; p_role?: "editor" | "viewer" };
        Returns: "added" | "already_member" | "not_found";
      };
      accept_trip_invitations: { Args: Record<string, never>; Returns: number };
      join_trip_by_code: { Args: { p_code: string }; Returns: Json };
      get_shared_trip: { Args: { p_token: string }; Returns: SharedTrip | null };
      settle_debt: { Args: { p_trip_id: string; p_from: string; p_to: string }; Returns: number };
      set_packing_packed: { Args: { p_item_id: string; p_packed: boolean }; Returns: undefined };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_suspended: { Args: Record<string, never>; Returns: boolean };
      admin_overview: { Args: Record<string, never>; Returns: AdminOverview };
      admin_report: { Args: { p_days?: number }; Returns: AdminReport };
      admin_list_users: {
        Args: { p_search?: string | null; p_filter?: string; p_limit?: number; p_offset?: number };
        Returns: AdminUserRow[];
      };
      admin_list_trips: {
        Args: { p_search?: string | null; p_filter?: string; p_limit?: number; p_offset?: number };
        Returns: AdminTripRow[];
      };
      admin_list_audit: {
        Args: { p_search?: string | null; p_entity?: string | null; p_limit?: number; p_offset?: number };
        Returns: AdminAuditRow[];
      };
      admin_set_admin: { Args: { p_user: string; p_grant: boolean }; Returns: undefined };
      admin_set_suspended: { Args: { p_user: string; p_suspend: boolean; p_reason?: string | null }; Returns: undefined };
      admin_unpublish_trip: { Args: { p_trip_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
