-- Travera v2.1 — make every screen live.
-- Adds the remaining tables to Supabase Realtime (RLS still decides who receives each change).
-- Run once in the Supabase SQL editor after v2-roles-privacy-admin.sql. Safe to re-run.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'trips', 'trip_members', 'trip_invitations', 'itinerary_days', 'stops',
    'expenses', 'expense_splits', 'member_budgets', 'packing_items', 'documents', 'audit_logs'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;  -- already published
    END;
  END LOOP;
END $$;
