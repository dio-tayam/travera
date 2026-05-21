-- Travera Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- TABLES
-- =====================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  home_currency TEXT NOT NULL DEFAULT 'PHP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT,
  cover_image_url TEXT,
  start_date DATE,
  end_date DATE,
  total_budget NUMERIC,
  currency TEXT NOT NULL DEFAULT 'PHP',
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  UNIQUE(trip_id, user_id)
);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('hotel', 'activity', 'restaurant', 'transit', 'flight', 'free')),
  title TEXT NOT NULL,
  address TEXT,
  lat FLOAT8,
  lng FLOAT8,
  place_id TEXT,
  start_time TIME,
  duration_minutes INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  paid_by UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  category TEXT NOT NULL CHECK (category IN ('food', 'accommodation', 'transport', 'activity', 'shopping', 'other')),
  description TEXT,
  date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  share_amount NUMERIC NOT NULL,
  is_settled BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  is_packed BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flight', 'hotel', 'visa', 'other'))
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trips: users can see trips they own or are a member of, OR public trips via share_token
CREATE POLICY "Members can view trips" ON trips FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM trip_members WHERE trip_id = trips.id AND user_id = auth.uid())
    OR is_public = true
  );
CREATE POLICY "Owner can insert trips" ON trips FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update trips" ON trips FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner can delete trips" ON trips FOR DELETE USING (auth.uid() = owner_id);

-- Trip members
CREATE POLICY "Members can view trip_members" ON trip_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = trip_members.trip_id AND tm.user_id = auth.uid()));
CREATE POLICY "Owner can manage trip_members" ON trip_members FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members tm WHERE tm.trip_id = trip_members.trip_id AND tm.user_id = auth.uid() AND tm.role = 'owner'));

-- Itinerary days
CREATE POLICY "Members can view itinerary_days" ON itinerary_days FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = itinerary_days.trip_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM trips WHERE id = itinerary_days.trip_id AND is_public = true));
CREATE POLICY "Editors can manage itinerary_days" ON itinerary_days FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = itinerary_days.trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')));

-- Stops
CREATE POLICY "Members can view stops" ON stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = stops.trip_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM trips WHERE id = stops.trip_id AND is_public = true));
CREATE POLICY "Editors can manage stops" ON stops FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = stops.trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')));

-- Expenses
CREATE POLICY "Members can view expenses" ON expenses FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = expenses.trip_id AND user_id = auth.uid()));
CREATE POLICY "Editors can manage expenses" ON expenses FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = expenses.trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')));

-- Expense splits
CREATE POLICY "Members can view expense_splits" ON expense_splits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM expenses e
    JOIN trip_members tm ON tm.trip_id = e.trip_id
    WHERE e.id = expense_splits.expense_id AND tm.user_id = auth.uid()
  ));
CREATE POLICY "Editors can manage expense_splits" ON expense_splits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM expenses e
    JOIN trip_members tm ON tm.trip_id = e.trip_id
    WHERE e.id = expense_splits.expense_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'editor')
  ));

-- Packing items
CREATE POLICY "Members can view packing_items" ON packing_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = packing_items.trip_id AND user_id = auth.uid()));
CREATE POLICY "Editors can manage packing_items" ON packing_items FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = packing_items.trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')));

-- Documents
CREATE POLICY "Members can view documents" ON documents FOR SELECT
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = documents.trip_id AND user_id = auth.uid()));
CREATE POLICY "Editors can manage documents" ON documents FOR ALL
  USING (EXISTS (SELECT 1 FROM trip_members WHERE trip_id = documents.trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')));

-- =====================
-- REALTIME
-- =====================
ALTER PUBLICATION supabase_realtime ADD TABLE stops;
ALTER PUBLICATION supabase_realtime ADD TABLE packing_items;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;

-- =====================
-- STORAGE
-- =====================
-- Run in Supabase Dashboard > Storage:
-- Create bucket "trip-documents" (private, 10MB limit)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit)
-- VALUES ('trip-documents', 'trip-documents', false, 10485760);

-- =====================
-- TRIGGER: auto-create profile on signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, home_currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'PHP'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
