export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Explicit row shapes ────────────────────────────────────────────────────

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
  role: "owner" | "editor" | "viewer";
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
};

export type ExpenseSplitRow = {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  is_settled: boolean;
};

export type PackingItemRow = {
  id: string;
  trip_id: string;
  assigned_to: string | null;
  label: string;
  category: string;
  is_packed: boolean;
  order_index: number;
};

export type DocumentRow = {
  id: string;
  trip_id: string;
  stop_id: string | null;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  type: "flight" | "hotel" | "visa" | "other";
};

// ── Database interface ─────────────────────────────────────────────────────
// Uses the `{ [_ in never]: never }` empty-map pattern that satisfies
// Supabase's GenericSchema index constraints without introducing `never`
// values in the table rows.

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at">;
        Update: Partial<Omit<ProfileRow, "id" | "created_at">>;
        Relationships: [];
      };
      trips: {
        Row: TripRow;
        Insert: Omit<TripRow, "id" | "created_at">;
        Update: Partial<Omit<TripRow, "id" | "created_at">>;
        Relationships: [];
      };
      trip_members: {
        Row: TripMemberRow;
        Insert: Omit<TripMemberRow, "id">;
        Update: Partial<Omit<TripMemberRow, "id">>;
        Relationships: [];
      };
      itinerary_days: {
        Row: ItineraryDayRow;
        Insert: Omit<ItineraryDayRow, "id">;
        Update: Partial<Omit<ItineraryDayRow, "id">>;
        Relationships: [];
      };
      stops: {
        Row: StopRow;
        Insert: Omit<StopRow, "id">;
        Update: Partial<Omit<StopRow, "id">>;
        Relationships: [];
      };
      expenses: {
        Row: ExpenseRow;
        Insert: Omit<ExpenseRow, "id">;
        Update: Partial<Omit<ExpenseRow, "id">>;
        Relationships: [];
      };
      expense_splits: {
        Row: ExpenseSplitRow;
        Insert: Omit<ExpenseSplitRow, "id">;
        Update: Partial<Omit<ExpenseSplitRow, "id">>;
        Relationships: [];
      };
      packing_items: {
        Row: PackingItemRow;
        Insert: Omit<PackingItemRow, "id">;
        Update: Partial<Omit<PackingItemRow, "id">>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: Omit<DocumentRow, "id">;
        Update: Partial<Omit<DocumentRow, "id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
