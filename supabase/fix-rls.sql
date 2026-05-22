-- ================================================================
-- COMPLETE RLS FIX — No infinite recursion
-- Run this in Supabase SQL Editor (replaces previous fix)
-- ================================================================

-- 1. Helper function — bypasses RLS to check membership safely
--    (SECURITY DEFINER queries the raw table, breaking the cycle)
CREATE OR REPLACE FUNCTION is_trip_member(p_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_id = p_trip_id AND user_id = auth.uid()
  )
$$;

-- ── Drop ALL existing policies ──────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','trips','trip_members','itinerary_days',
        'stops','expenses','expense_splits','packing_items','documents'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── profiles ─────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (true);  -- profiles are readable by anyone authenticated
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ── trips ─────────────────────────────────────────────────────────
-- Uses is_trip_member() helper — no direct trip_members reference
CREATE POLICY "trips_select" ON trips FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_public = true
    OR is_trip_member(id)
  );
CREATE POLICY "trips_insert" ON trips FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "trips_update" ON trips FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "trips_delete" ON trips FOR DELETE
  USING (owner_id = auth.uid());

-- ── trip_members ──────────────────────────────────────────────────
-- Uses is_trip_member() so no reference to trips (no cycle)
CREATE POLICY "tm_select" ON trip_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_trip_member(trip_id)
  );
CREATE POLICY "tm_insert" ON trip_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR is_trip_member(trip_id)
  );
CREATE POLICY "tm_update" ON trip_members FOR UPDATE
  USING (is_trip_member(trip_id));
CREATE POLICY "tm_delete" ON trip_members FOR DELETE
  USING (is_trip_member(trip_id) OR user_id = auth.uid());

-- ── itinerary_days ────────────────────────────────────────────────
CREATE POLICY "days_select" ON itinerary_days FOR SELECT
  USING (
    is_trip_member(trip_id)
    OR trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid() OR is_public = true)
  );
CREATE POLICY "days_all" ON itinerary_days FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR is_trip_member(trip_id)
  );

-- ── stops ─────────────────────────────────────────────────────────
CREATE POLICY "stops_select" ON stops FOR SELECT
  USING (
    is_trip_member(trip_id)
    OR trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid() OR is_public = true)
  );
CREATE POLICY "stops_all" ON stops FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR is_trip_member(trip_id)
  );

-- ── expenses ──────────────────────────────────────────────────────
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (
    is_trip_member(trip_id)
    OR trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );
CREATE POLICY "expenses_all" ON expenses FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR is_trip_member(trip_id)
  );

-- ── expense_splits ────────────────────────────────────────────────
CREATE POLICY "splits_select" ON expense_splits FOR SELECT
  USING (
    user_id = auth.uid()
    OR expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN (
        SELECT id FROM trips WHERE owner_id = auth.uid()
      )
    )
  );
CREATE POLICY "splits_all" ON expense_splits FOR ALL
  USING (
    expense_id IN (
      SELECT id FROM expenses WHERE trip_id IN (
        SELECT id FROM trips WHERE owner_id = auth.uid()
      )
    )
    OR user_id = auth.uid()
  );

-- ── packing_items ─────────────────────────────────────────────────
CREATE POLICY "packing_select" ON packing_items FOR SELECT
  USING (
    is_trip_member(trip_id)
    OR trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );
CREATE POLICY "packing_all" ON packing_items FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR is_trip_member(trip_id)
  );

-- ── documents ─────────────────────────────────────────────────────
CREATE POLICY "docs_select" ON documents FOR SELECT
  USING (
    is_trip_member(trip_id)
    OR trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
  );
CREATE POLICY "docs_all" ON documents FOR ALL
  USING (
    trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    OR is_trip_member(trip_id)
  );
