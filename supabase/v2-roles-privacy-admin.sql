-- =====================================================================
-- Travera v2 — roles, group vs. private content, activity log, admin
--
-- Run in the Supabase SQL editor AFTER:
--   schema.sql → fix-rls.sql → setup-storage.sql → trip-invitations.sql
-- It replaces every RLS policy on the app tables and the storage bucket,
-- so it is safe to re-run.
--
-- Roles
--   owner   trip settings, sharing, travelers, everything an editor can do,
--           and can remove any group document
--   editor  edits the group itinerary, group budget, group packing list and
--           group documents
--   viewer  reads group content; ticks group packing items assigned to them;
--           confirms payments owed to them
--   every member (viewers too) has a private space: personal expenses,
--   a personal packing list, private documents and a personal budget —
--   nobody else, including trip owners and admins, can read those rows.
--
-- After running, make yourself an admin (replace the email):
--   INSERT INTO public.admin_users (user_id)
--   SELECT id FROM auth.users WHERE email = 'you@example.com'
--   ON CONFLICT DO NOTHING;
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. NEW COLUMNS & TABLES
-- =====================================================================

-- Expenses: group (split between travelers) or personal (private to creator)
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'group';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.expenses SET created_by = paid_by WHERE created_by IS NULL;

-- Packing: group list (owner/editors manage, can assign) or personal list
ALTER TABLE public.packing_items ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'group';
ALTER TABLE public.packing_items ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.packing_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Documents: shared with the group or private to the uploader
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'group';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_scope_check CHECK (scope IN ('group', 'personal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.packing_items ADD CONSTRAINT packing_scope_check CHECK (scope IN ('group', 'personal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.documents ADD CONSTRAINT documents_visibility_check CHECK (visibility IN ('group', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object OR check_violation THEN NULL; END $$;

-- Personal budget per traveler per trip (private to that traveler)
CREATE TABLE IF NOT EXISTS public.member_budgets (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

-- Admins are managed only from the SQL editor or the admin console RPCs.
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_suspensions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  suspended_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only activity log, written only by triggers / SECURITY DEFINER functions.
-- Private items (personal expenses/packing, private docs) are logged without their content.
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  trip_id UUID,
  is_private BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_logs_trip_idx    ON public.audit_logs (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx   ON public.audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trip_members_user_idx  ON public.trip_members (user_id);
CREATE INDEX IF NOT EXISTS expenses_trip_idx      ON public.expenses (trip_id);
CREATE INDEX IF NOT EXISTS splits_expense_idx     ON public.expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS packing_trip_idx       ON public.packing_items (trip_id);
CREATE INDEX IF NOT EXISTS documents_trip_idx     ON public.documents (trip_id);
CREATE INDEX IF NOT EXISTS documents_path_idx     ON public.documents (storage_path);
CREATE INDEX IF NOT EXISTS stops_trip_idx         ON public.stops (trip_id);

-- =====================================================================
-- 2. HELPER FUNCTIONS (SECURITY DEFINER → no RLS recursion)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.try_uuid(p TEXT) RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p::uuid END
$$;

CREATE OR REPLACE FUNCTION public.is_suspended() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_suspensions WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM user_suspensions WHERE user_id = auth.uid())
$$;

/** The caller's role on a trip, or NULL (also NULL while suspended). */
CREATE OR REPLACE FUNCTION public.trip_role(p_trip_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM trip_members m
  WHERE m.trip_id = p_trip_id AND m.user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM user_suspensions s WHERE s.user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_trip_member(p_trip_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.trip_role(p_trip_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.can_edit_trip(p_trip_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.trip_role(p_trip_id) IN ('owner', 'editor'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.trip_role(p_trip_id) = 'owner', false)
$$;

/** Is p_user on the trip? Only answers for trips the caller belongs to. */
CREATE OR REPLACE FUNCTION public.is_member_user(p_trip_id UUID, p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_trip_member(p_trip_id)
     AND EXISTS (SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = p_user)
$$;

/** Do the caller and p_user share at least one trip? */
CREATE OR REPLACE FUNCTION public.shares_trip_with(p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_members mine
    JOIN trip_members theirs ON theirs.trip_id = mine.trip_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = p_user
  ) AND NOT public.is_suspended()
$$;

CREATE OR REPLACE FUNCTION public.can_view_expense(p_expense_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = p_expense_id AND public.is_trip_member(e.trip_id)
      AND (e.scope = 'group' OR e.created_by = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_expense(p_expense_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = p_expense_id AND (
      (e.scope = 'group' AND public.can_edit_trip(e.trip_id))
      OR (e.scope = 'personal' AND e.created_by = auth.uid() AND public.is_trip_member(e.trip_id))
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.split_user_ok(p_expense_id UUID, p_user UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM expenses e JOIN trip_members m ON m.trip_id = e.trip_id
    WHERE e.id = p_expense_id AND m.user_id = p_user
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_document_path(p_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = p_name AND public.is_trip_member(d.trip_id)
      AND (d.visibility = 'group' OR d.uploaded_by = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.can_delete_document_path(p_name TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.storage_path = p_name AND public.is_trip_member(d.trip_id)
      AND (d.uploaded_by = auth.uid() OR (d.visibility = 'group' AND public.is_trip_owner(d.trip_id)))
  )
$$;

REVOKE ALL ON FUNCTION public.is_suspended(), public.is_admin(), public.trip_role(UUID),
  public.is_trip_member(UUID), public.can_edit_trip(UUID), public.is_trip_owner(UUID),
  public.is_member_user(UUID, UUID), public.shares_trip_with(UUID), public.can_view_expense(UUID),
  public.can_manage_expense(UUID), public.split_user_ok(UUID, UUID),
  public.can_read_document_path(TEXT), public.can_delete_document_path(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_suspended(), public.is_admin(), public.trip_role(UUID),
  public.is_trip_member(UUID), public.can_edit_trip(UUID), public.is_trip_owner(UUID),
  public.is_member_user(UUID, UUID), public.shares_trip_with(UUID), public.can_view_expense(UUID),
  public.can_manage_expense(UUID), public.split_user_ok(UUID, UUID),
  public.can_read_document_path(TEXT), public.can_delete_document_path(TEXT) TO anon, authenticated;

-- =====================================================================
-- 3. INTEGRITY TRIGGERS (ownership columns can't be spoofed or moved)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.stamp_created_by() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.trip_id := OLD.trip_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS expenses_stamp ON public.expenses;
CREATE TRIGGER expenses_stamp BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.stamp_created_by();
DROP TRIGGER IF EXISTS packing_stamp ON public.packing_items;
CREATE TRIGGER packing_stamp BEFORE INSERT OR UPDATE ON public.packing_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_created_by();

CREATE OR REPLACE FUNCTION public.stamp_document() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by := COALESCE(auth.uid(), NEW.uploaded_by);
  ELSE
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.storage_path := OLD.storage_path;
    NEW.trip_id := OLD.trip_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS documents_stamp ON public.documents;
CREATE TRIGGER documents_stamp BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.stamp_document();

CREATE OR REPLACE FUNCTION public.lock_trip_owner() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trips_lock_owner ON public.trips;
CREATE TRIGGER trips_lock_owner BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.lock_trip_owner();

-- The trip creator always becomes its owner member (clients no longer insert it).
CREATE OR REPLACE FUNCTION public.add_trip_owner_member() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (trip_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trips_add_owner ON public.trips;
CREATE TRIGGER trips_add_owner AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.add_trip_owner_member();

-- =====================================================================
-- 4. ACTIVITY / AUDIT LOG
-- =====================================================================

CREATE OR REPLACE FUNCTION public.audit_row() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec JSONB;
  old_rec JSONB;
  v_trip UUID;
  v_action TEXT;
  v_private BOOLEAN := false;
  v_meta JSONB := '{}'::jsonb;
BEGIN
  rec := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_OP = 'UPDATE' THEN old_rec := to_jsonb(OLD); END IF;
  v_action := CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END;
  v_trip := CASE WHEN TG_TABLE_NAME = 'trips' THEN (rec->>'id')::uuid ELSE (rec->>'trip_id')::uuid END;

  -- A deleted trip cascades to its children; only the trip deletion itself is logged.
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME <> 'trips'
     AND NOT EXISTS (SELECT 1 FROM trips WHERE id = v_trip) THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'trips' THEN
      v_meta := jsonb_build_object('title', rec->>'title', 'destination', rec->>'destination');
      IF TG_OP = 'UPDATE' THEN
        IF (old_rec->>'is_public') IS DISTINCT FROM (rec->>'is_public') THEN
          v_action := CASE WHEN (rec->>'is_public')::boolean THEN 'shared_publicly' ELSE 'made_private' END;
        ELSIF old_rec = rec THEN
          RETURN NULL;
        END IF;
      END IF;
    WHEN 'trip_members' THEN
      v_action := CASE TG_OP WHEN 'INSERT' THEN 'joined' WHEN 'UPDATE' THEN 'role_changed' ELSE 'left' END;
      IF TG_OP = 'UPDATE' AND (old_rec->>'role') = (rec->>'role') THEN RETURN NULL; END IF;
      v_meta := jsonb_build_object(
        'user_id', rec->>'user_id', 'role', rec->>'role', 'from', old_rec->>'role',
        'name', (SELECT display_name FROM profiles WHERE id = (rec->>'user_id')::uuid));
    WHEN 'stops' THEN
      -- Reordering alone is noise.
      IF TG_OP = 'UPDATE' AND (old_rec - 'order_index') = (rec - 'order_index') THEN RETURN NULL; END IF;
      v_meta := jsonb_build_object('title', rec->>'title', 'type', rec->>'type');
    WHEN 'expenses' THEN
      v_private := rec->>'scope' = 'personal';
      IF NOT v_private THEN
        v_meta := jsonb_build_object('description', rec->>'description', 'amount', rec->'amount',
          'currency', rec->>'currency', 'category', rec->>'category', 'paid_by', rec->>'paid_by');
      END IF;
    WHEN 'packing_items' THEN
      v_private := rec->>'scope' = 'personal';
      IF TG_OP = 'UPDATE' THEN
        IF (old_rec->>'is_packed') IS DISTINCT FROM (rec->>'is_packed') THEN
          v_action := CASE WHEN (rec->>'is_packed')::boolean THEN 'packed' ELSE 'unpacked' END;
        ELSIF (old_rec->>'assigned_to') IS DISTINCT FROM (rec->>'assigned_to') THEN
          v_action := 'assigned';
        ELSIF (old_rec - 'order_index') = (rec - 'order_index') THEN
          RETURN NULL;
        END IF;
      END IF;
      IF NOT v_private THEN
        v_meta := jsonb_build_object('label', rec->>'label', 'assigned_to', rec->>'assigned_to');
      END IF;
    WHEN 'documents' THEN
      v_private := rec->>'visibility' = 'private';
      IF NOT v_private THEN
        v_meta := jsonb_build_object('file_name', rec->>'file_name', 'type', rec->>'type');
      END IF;
    ELSE
      NULL;
  END CASE;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, trip_id, is_private, metadata)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, (rec->>'id')::uuid, v_trip, v_private, v_meta);
  RETURN NULL;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips', 'trip_members', 'stops', 'expenses', 'packing_items', 'documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t || '_audit', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.log_sign_in() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    BEGIN
      INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id)
      VALUES (NEW.id, 'signed_in', 'auth', NEW.id);
    EXCEPTION WHEN OTHERS THEN NULL;  -- never block sign-in
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_sign_in();

-- New accounts: create the profile, join any trips they were invited to, log the signup.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, home_currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'PHP'
  )
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    INSERT INTO public.trip_members (trip_id, user_id, role)
    SELECT i.trip_id, NEW.id, i.role FROM public.trip_invitations i
    WHERE lower(i.email) = lower(NEW.email)
    ON CONFLICT (trip_id, user_id) DO NOTHING;
    DELETE FROM public.trip_invitations WHERE lower(email) = lower(NEW.email);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id)
    VALUES (NEW.id, 'signed_up', 'auth', NEW.id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $$;

-- =====================================================================
-- 5. ROW LEVEL SECURITY — drop everything, then recreate
-- =====================================================================

ALTER TABLE public.member_budgets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'profiles', 'trips', 'trip_members', 'trip_invitations', 'itinerary_days', 'stops',
      'expenses', 'expense_splits', 'packing_items', 'documents', 'member_budgets',
      'admin_users', 'user_suspensions', 'audit_logs')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── profiles: yourself, people you travel with ──────────────────────
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.shares_trip_with(id));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── trips (public share links go through get_shared_trip(), not RLS) ─
CREATE POLICY trips_select ON public.trips FOR SELECT
  USING ((owner_id = auth.uid() AND NOT public.is_suspended()) OR public.is_trip_member(id));
CREATE POLICY trips_insert ON public.trips FOR INSERT
  WITH CHECK (owner_id = auth.uid() AND NOT public.is_suspended());
CREATE POLICY trips_update ON public.trips FOR UPDATE
  USING (public.is_trip_owner(id)) WITH CHECK (public.is_trip_owner(id));
CREATE POLICY trips_delete ON public.trips FOR DELETE USING (public.is_trip_owner(id));

-- ── trip_members ────────────────────────────────────────────────────
CREATE POLICY tm_select ON public.trip_members FOR SELECT USING (public.is_trip_member(trip_id));
-- Owners add editors/viewers (the owner row itself is created by trigger).
CREATE POLICY tm_insert ON public.trip_members FOR INSERT
  WITH CHECK (public.is_trip_owner(trip_id) AND role IN ('editor', 'viewer'));
-- Owners change other travelers' roles, never to owner and never their own.
CREATE POLICY tm_update ON public.trip_members FOR UPDATE
  USING (public.is_trip_owner(trip_id) AND user_id <> auth.uid())
  WITH CHECK (public.is_trip_owner(trip_id) AND user_id <> auth.uid() AND role IN ('editor', 'viewer'));
-- Owners remove others; anyone but the owner can leave.
CREATE POLICY tm_delete ON public.trip_members FOR DELETE
  USING ((public.is_trip_owner(trip_id) AND user_id <> auth.uid())
         OR (user_id = auth.uid() AND role <> 'owner'));

-- ── trip_invitations ────────────────────────────────────────────────
CREATE POLICY inv_owner_all ON public.trip_invitations FOR ALL
  USING (public.is_trip_owner(trip_id))
  WITH CHECK (public.is_trip_owner(trip_id) AND invited_by = auth.uid());

-- ── itinerary_days & stops: members read, owner/editors write ───────
CREATE POLICY days_select ON public.itinerary_days FOR SELECT USING (public.is_trip_member(trip_id));
CREATE POLICY days_insert ON public.itinerary_days FOR INSERT WITH CHECK (public.can_edit_trip(trip_id));
CREATE POLICY days_update ON public.itinerary_days FOR UPDATE
  USING (public.can_edit_trip(trip_id)) WITH CHECK (public.can_edit_trip(trip_id));
CREATE POLICY days_delete ON public.itinerary_days FOR DELETE USING (public.can_edit_trip(trip_id));

CREATE POLICY stops_select ON public.stops FOR SELECT USING (public.is_trip_member(trip_id));
CREATE POLICY stops_insert ON public.stops FOR INSERT
  WITH CHECK (public.can_edit_trip(trip_id)
              AND EXISTS (SELECT 1 FROM public.itinerary_days d WHERE d.id = day_id AND d.trip_id = stops.trip_id));
CREATE POLICY stops_update ON public.stops FOR UPDATE
  USING (public.can_edit_trip(trip_id))
  WITH CHECK (public.can_edit_trip(trip_id)
              AND EXISTS (SELECT 1 FROM public.itinerary_days d WHERE d.id = day_id AND d.trip_id = stops.trip_id));
CREATE POLICY stops_delete ON public.stops FOR DELETE USING (public.can_edit_trip(trip_id));

-- ── expenses ────────────────────────────────────────────────────────
CREATE POLICY expenses_select ON public.expenses FOR SELECT
  USING (public.is_trip_member(trip_id) AND (scope = 'group' OR created_by = auth.uid()));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT
  WITH CHECK (
    (scope = 'group' AND public.can_edit_trip(trip_id) AND public.is_member_user(trip_id, paid_by))
    OR (scope = 'personal' AND public.is_trip_member(trip_id) AND created_by = auth.uid() AND paid_by = auth.uid()));
CREATE POLICY expenses_update ON public.expenses FOR UPDATE
  USING ((scope = 'group' AND public.can_edit_trip(trip_id))
         OR (scope = 'personal' AND created_by = auth.uid() AND public.is_trip_member(trip_id)))
  WITH CHECK (
    (scope = 'group' AND public.can_edit_trip(trip_id) AND public.is_member_user(trip_id, paid_by))
    OR (scope = 'personal' AND public.is_trip_member(trip_id) AND created_by = auth.uid() AND paid_by = auth.uid()));
CREATE POLICY expenses_delete ON public.expenses FOR DELETE
  USING ((scope = 'group' AND public.can_edit_trip(trip_id))
         OR (scope = 'personal' AND created_by = auth.uid() AND public.is_trip_member(trip_id)));

-- ── expense_splits (settling goes through settle_debt()) ────────────
CREATE POLICY splits_select ON public.expense_splits FOR SELECT USING (public.can_view_expense(expense_id));
CREATE POLICY splits_insert ON public.expense_splits FOR INSERT
  WITH CHECK (public.can_manage_expense(expense_id) AND public.split_user_ok(expense_id, user_id)
              AND share_amount >= 0);
CREATE POLICY splits_update ON public.expense_splits FOR UPDATE
  USING (public.can_manage_expense(expense_id))
  WITH CHECK (public.can_manage_expense(expense_id) AND public.split_user_ok(expense_id, user_id)
              AND share_amount >= 0);
CREATE POLICY splits_delete ON public.expense_splits FOR DELETE USING (public.can_manage_expense(expense_id));

-- ── member_budgets: strictly your own ───────────────────────────────
CREATE POLICY mb_all ON public.member_budgets FOR ALL
  USING (user_id = auth.uid() AND public.is_trip_member(trip_id))
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id));

-- ── packing_items (assignees tick via set_packing_packed()) ─────────
CREATE POLICY packing_select ON public.packing_items FOR SELECT
  USING (public.is_trip_member(trip_id) AND (scope = 'group' OR created_by = auth.uid()));
CREATE POLICY packing_insert ON public.packing_items FOR INSERT
  WITH CHECK (
    (scope = 'group' AND public.can_edit_trip(trip_id)
       AND (assigned_to IS NULL OR public.is_member_user(trip_id, assigned_to)))
    OR (scope = 'personal' AND public.is_trip_member(trip_id) AND created_by = auth.uid()
       AND (assigned_to IS NULL OR assigned_to = auth.uid())));
CREATE POLICY packing_update ON public.packing_items FOR UPDATE
  USING ((scope = 'group' AND public.can_edit_trip(trip_id))
         OR (scope = 'personal' AND created_by = auth.uid() AND public.is_trip_member(trip_id)))
  WITH CHECK (
    (scope = 'group' AND public.can_edit_trip(trip_id)
       AND (assigned_to IS NULL OR public.is_member_user(trip_id, assigned_to)))
    OR (scope = 'personal' AND public.is_trip_member(trip_id) AND created_by = auth.uid()
       AND (assigned_to IS NULL OR assigned_to = auth.uid())));
CREATE POLICY packing_delete ON public.packing_items FOR DELETE
  USING ((scope = 'group' AND public.can_edit_trip(trip_id))
         OR (scope = 'personal' AND created_by = auth.uid() AND public.is_trip_member(trip_id)));

-- ── documents ───────────────────────────────────────────────────────
CREATE POLICY docs_select ON public.documents FOR SELECT
  USING (public.is_trip_member(trip_id) AND (visibility = 'group' OR uploaded_by = auth.uid()));
CREATE POLICY docs_insert ON public.documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND public.is_trip_member(trip_id)
    AND (visibility = 'private' OR public.can_edit_trip(trip_id))
    AND storage_path LIKE trip_id::text || '/' || auth.uid()::text || '/%');
CREATE POLICY docs_update ON public.documents FOR UPDATE
  USING (public.is_trip_member(trip_id)
         AND (uploaded_by = auth.uid() OR (visibility = 'group' AND public.is_trip_owner(trip_id))))
  WITH CHECK ((visibility = 'private' AND uploaded_by = auth.uid() AND public.is_trip_member(trip_id))
              OR (visibility = 'group' AND public.can_edit_trip(trip_id)));
CREATE POLICY docs_delete ON public.documents FOR DELETE
  USING (public.is_trip_member(trip_id)
         AND (uploaded_by = auth.uid() OR (visibility = 'group' AND public.is_trip_owner(trip_id))));

-- ── admin tables: no direct client access (RPCs only) ───────────────
-- (RLS enabled with no policies = deny all.)

-- ── audit_logs: members see their trip's group activity + their own private events
CREATE POLICY audit_select ON public.audit_logs FOR SELECT
  USING (trip_id IS NOT NULL AND public.is_trip_member(trip_id)
         AND (NOT is_private OR actor_id = auth.uid()));

-- =====================================================================
-- 6. STORAGE — files are readable only when the matching document row is
-- =====================================================================

DROP POLICY IF EXISTS "trip_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "trip_docs_delete" ON storage.objects;

-- Path format: {trip_id}/{user_id}/{timestamp}_{filename}
CREATE POLICY "trip_docs_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-documents'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_trip_member(public.try_uuid((storage.foldername(name))[1])));

-- Readable when the matching document row is visible to you, or when it's your own upload
-- (the latter is needed for INSERT … RETURNING during upload).
CREATE POLICY "trip_docs_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-documents' AND (
    public.can_read_document_path(name)
    OR ((storage.foldername(name))[2] = auth.uid()::text
        AND public.is_trip_member(public.try_uuid((storage.foldername(name))[1])))));

CREATE POLICY "trip_docs_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'trip-documents'
         AND ((storage.foldername(name))[2] = auth.uid()::text OR public.can_delete_document_path(name)));

-- Tighten the bucket: private, 10 MB, documents and images only.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
WHERE id = 'trip-documents';

-- =====================================================================
-- 7. APP RPCs
-- =====================================================================

-- Read-only public view of a shared trip. Exposes no budget, members or documents.
CREATE OR REPLACE FUNCTION public.get_shared_trip(p_token TEXT) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'trip', jsonb_build_object('id', t.id, 'title', t.title, 'destination', t.destination,
              'cover_image_url', t.cover_image_url, 'start_date', t.start_date, 'end_date', t.end_date),
    'owner', (SELECT jsonb_build_object('display_name', p.display_name, 'avatar_url', p.avatar_url)
              FROM profiles p WHERE p.id = t.owner_id),
    'days', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.day_number)
                      FROM itinerary_days d WHERE d.trip_id = t.id), '[]'::jsonb),
    'stops', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.order_index)
                       FROM stops s WHERE s.trip_id = t.id), '[]'::jsonb)
  )
  FROM trips t
  WHERE t.share_token = p_token AND t.is_public = true AND length(p_token) >= 12
$$;
REVOKE ALL ON FUNCTION public.get_shared_trip(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_trip(TEXT) TO anon, authenticated;

-- Owner adds an existing account by email. Returns 'added' | 'already_member' | 'not_found'.
DROP FUNCTION IF EXISTS public.add_registered_trip_member(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.add_trip_member_by_email(p_trip_id UUID, p_email TEXT, p_role TEXT DEFAULT 'editor')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_user UUID;
BEGIN
  IF NOT public.is_trip_owner(p_trip_id) THEN
    RAISE EXCEPTION 'Only the trip owner can add travelers' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO target_user FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target_user IS NULL THEN RETURN 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = target_user) THEN
    RETURN 'already_member';
  END IF;

  INSERT INTO trip_members (trip_id, user_id, role) VALUES (p_trip_id, target_user, p_role);
  RETURN 'added';
END $$;
REVOKE ALL ON FUNCTION public.add_trip_member_by_email(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_trip_member_by_email(UUID, TEXT, TEXT) TO authenticated;

-- Join trips you were invited to by email (called after every sign-in).
CREATE OR REPLACE FUNCTION public.accept_trip_invitations() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted INTEGER; my_email TEXT;
BEGIN
  IF public.is_suspended() THEN RETURN 0; END IF;
  SELECT email INTO my_email FROM auth.users WHERE id = auth.uid();
  IF my_email IS NULL THEN RETURN 0; END IF;
  INSERT INTO trip_members (trip_id, user_id, role)
  SELECT i.trip_id, auth.uid(), i.role FROM trip_invitations i WHERE lower(i.email) = lower(my_email)
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  GET DIAGNOSTICS accepted = ROW_COUNT;
  DELETE FROM trip_invitations WHERE lower(email) = lower(my_email);
  RETURN accepted;
END $$;
REVOKE ALL ON FUNCTION public.accept_trip_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trip_invitations() TO authenticated;

-- Settle up between two travelers: marks every open group split between them (both directions) as
-- paid, after p_from has paid p_to the net amount. Allowed for owner/editors, or for p_to — the person
-- receiving the money confirms it arrived.
CREATE OR REPLACE FUNCTION public.settle_debt(p_trip_id UUID, p_from UUID, p_to UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER; total NUMERIC;
BEGIN
  IF NOT (public.can_edit_trip(p_trip_id) OR (auth.uid() = p_to AND public.is_trip_member(p_trip_id))) THEN
    RAISE EXCEPTION 'Not allowed to settle this payment' USING ERRCODE = '42501';
  END IF;
  WITH upd AS (
    UPDATE expense_splits s SET is_settled = true
    FROM expenses e
    WHERE s.expense_id = e.id AND e.trip_id = p_trip_id AND e.scope = 'group'
      AND NOT s.is_settled
      AND ((e.paid_by = p_to AND s.user_id = p_from) OR (e.paid_by = p_from AND s.user_id = p_to))
    RETURNING s.share_amount
  )
  SELECT count(*), COALESCE(sum(share_amount), 0) INTO n, total FROM upd;
  IF n > 0 THEN
    INSERT INTO audit_logs (actor_id, action, entity_type, trip_id, metadata)
    VALUES (auth.uid(), 'settled', 'expense_splits', p_trip_id,
            jsonb_build_object('from', p_from, 'to', p_to, 'amount', total));
  END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.settle_debt(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_debt(UUID, UUID, UUID) TO authenticated;

-- Tick/untick a packing item: managers, the assignee, or the owner of a personal item.
CREATE OR REPLACE FUNCTION public.set_packing_packed(p_item_id UUID, p_packed BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it packing_items;
BEGIN
  SELECT * INTO it FROM packing_items WHERE id = p_item_id;
  IF it.id IS NULL OR NOT public.is_trip_member(it.trip_id) THEN
    RAISE EXCEPTION 'Item not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    (it.scope = 'group' AND (public.can_edit_trip(it.trip_id) OR it.assigned_to = auth.uid()))
    OR (it.scope = 'personal' AND it.created_by = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this item' USING ERRCODE = '42501';
  END IF;
  UPDATE packing_items SET is_packed = p_packed WHERE id = p_item_id;
END $$;
REVOKE ALL ON FUNCTION public.set_packing_packed(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_packing_packed(UUID, BOOLEAN) TO authenticated;

-- =====================================================================
-- 8. ADMIN RPCs — aggregates and metadata only; never private content
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_guard() RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_overview() RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE result JSONB;
BEGIN
  PERFORM public.admin_guard();
  SELECT jsonb_build_object(
    'users',            (SELECT count(*) FROM auth.users),
    'users_7d',         (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_30d',        (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'active_7d',        (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days'),
    'active_30d',       (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '30 days'),
    'trips',            (SELECT count(*) FROM trips),
    'trips_7d',         (SELECT count(*) FROM trips WHERE created_at > now() - interval '7 days'),
    'trips_public',     (SELECT count(*) FROM trips WHERE is_public),
    'trips_active',     (SELECT count(*) FROM trips WHERE start_date <= current_date AND end_date >= current_date),
    'trips_upcoming',   (SELECT count(*) FROM trips WHERE start_date > current_date),
    'trips_group',      (SELECT count(*) FROM (SELECT trip_id FROM trip_members GROUP BY trip_id HAVING count(*) > 1) g),
    'memberships',      (SELECT count(*) FROM trip_members),
    'roles',            (SELECT COALESCE(jsonb_object_agg(role, n), '{}'::jsonb)
                         FROM (SELECT role, count(*) n FROM trip_members GROUP BY role) r),
    'stops',            (SELECT count(*) FROM stops),
    'expenses',         (SELECT count(*) FROM expenses),
    'expenses_personal',(SELECT count(*) FROM expenses WHERE scope = 'personal'),
    'spend_by_currency',(SELECT COALESCE(jsonb_agg(jsonb_build_object('currency', currency, 'total', total, 'count', n)), '[]'::jsonb)
                         FROM (SELECT currency, sum(amount) total, count(*) n FROM expenses WHERE scope = 'group'
                               GROUP BY currency ORDER BY count(*) DESC LIMIT 6) s),
    'packing_items',    (SELECT count(*) FROM packing_items),
    'packing_packed',   (SELECT count(*) FROM packing_items WHERE is_packed),
    'documents',        (SELECT count(*) FROM documents),
    'documents_private',(SELECT count(*) FROM documents WHERE visibility = 'private'),
    'storage_bytes',    (SELECT COALESCE(sum((metadata->>'size')::bigint), 0) FROM storage.objects WHERE bucket_id = 'trip-documents'),
    'invitations',      (SELECT count(*) FROM trip_invitations),
    'suspended',        (SELECT count(*) FROM user_suspensions),
    'admins',           (SELECT count(*) FROM admin_users),
    'events_24h',       (SELECT count(*) FROM audit_logs WHERE created_at > now() - interval '24 hours'),
    'signups_daily',    (SELECT jsonb_agg(jsonb_build_object('day', d::date,
                           'n', (SELECT count(*) FROM auth.users u WHERE u.created_at::date = d::date)) ORDER BY d)
                         FROM generate_series(current_date - 29, current_date, interval '1 day') d),
    'trips_daily',      (SELECT jsonb_agg(jsonb_build_object('day', d::date,
                           'n', (SELECT count(*) FROM trips t WHERE t.created_at::date = d::date)) ORDER BY d)
                         FROM generate_series(current_date - 29, current_date, interval '1 day') d),
    'top_destinations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'n', n)), '[]'::jsonb)
                         FROM (SELECT initcap(trim(destination)) AS name, count(*) n FROM trips
                               WHERE destination IS NOT NULL AND trim(destination) <> ''
                               GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8) x)
  ) INTO result;
  RETURN result;
END $$;

-- Daily activity report for the last p_days (7–365).
CREATE OR REPLACE FUNCTION public.admin_report(p_days INTEGER DEFAULT 30) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 30), 7), 365); result JSONB;
BEGIN
  PERFORM public.admin_guard();
  WITH days AS (
    SELECT generate_series(current_date - (v_days - 1), current_date, interval '1 day')::date AS d
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'daily', (SELECT jsonb_agg(jsonb_build_object(
        'day', d,
        'signups',   (SELECT count(*) FROM auth.users WHERE created_at::date = d),
        'active',    (SELECT count(DISTINCT actor_id) FROM audit_logs WHERE action = 'signed_in' AND created_at::date = d),
        'trips',     (SELECT count(*) FROM trips WHERE created_at::date = d),
        'expenses',  (SELECT count(*) FROM expenses WHERE created_at::date = d),
        'documents', (SELECT count(*) FROM documents WHERE created_at::date = d),
        'packing',   (SELECT count(*) FROM packing_items WHERE created_at::date = d),
        'events',    (SELECT count(*) FROM audit_logs WHERE created_at::date = d)
      ) ORDER BY d) FROM days),
    'expense_categories', (SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'n', n) ORDER BY n DESC), '[]'::jsonb)
        FROM (SELECT category, count(*) n FROM expenses
              WHERE created_at::date > current_date - v_days GROUP BY category) c),
    'document_types', (SELECT COALESCE(jsonb_agg(jsonb_build_object('type', type, 'n', n) ORDER BY n DESC), '[]'::jsonb)
        FROM (SELECT type, count(*) n FROM documents
              WHERE created_at::date > current_date - v_days GROUP BY type) c),
    'group_sizes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('size', size, 'n', n) ORDER BY size), '[]'::jsonb)
        FROM (SELECT LEAST(size, 6) AS size, count(*) n
              FROM (SELECT count(*) AS size FROM trip_members GROUP BY trip_id) s GROUP BY 1) g)
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL, p_filter TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 25, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, email TEXT, display_name TEXT, avatar_url TEXT, created_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ,
  trip_count BIGINT, owned_count BIGINT, is_admin BOOLEAN, is_suspended BOOLEAN, suspension_reason TEXT,
  total_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_guard();
  RETURN QUERY
  WITH base AS (
    SELECT u.id AS uid, u.email::text AS uemail, p.display_name AS uname, p.avatar_url AS uavatar,
           u.created_at AS ucreated, u.last_sign_in_at AS useen,
           (SELECT count(*) FROM public.trip_members m WHERE m.user_id = u.id) AS ntrips,
           (SELECT count(*) FROM public.trips t WHERE t.owner_id = u.id) AS nowned,
           EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id) AS uadmin,
           (s.user_id IS NOT NULL) AS ususpended, s.reason AS ureason
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.user_suspensions s ON s.user_id = u.id
    WHERE p_search IS NULL OR trim(p_search) = ''
       OR u.email ILIKE '%' || trim(p_search) || '%'
       OR p.display_name ILIKE '%' || trim(p_search) || '%'
  )
  SELECT b.uid, b.uemail, b.uname, b.uavatar, b.ucreated, b.useen, b.ntrips, b.nowned,
         b.uadmin, b.ususpended, b.ureason, count(*) OVER ()
  FROM base b
  WHERE p_filter = 'all' OR p_filter IS NULL
     OR (p_filter = 'admins' AND b.uadmin)
     OR (p_filter = 'suspended' AND b.ususpended)
     OR (p_filter = 'inactive' AND (b.useen IS NULL OR b.useen < now() - interval '30 days'))
  ORDER BY b.ucreated DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_trips(
  p_search TEXT DEFAULT NULL, p_filter TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 25, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, title TEXT, destination TEXT, owner_id UUID, owner_name TEXT, owner_email TEXT,
  member_count BIGINT, is_public BOOLEAN, start_date DATE, end_date DATE, created_at TIMESTAMPTZ,
  stop_count BIGINT, expense_count BIGINT, document_count BIGINT, total_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_guard();
  RETURN QUERY
  WITH base AS (
    SELECT t.id AS tid, t.title AS ttitle, t.destination AS tdest, t.owner_id AS towner,
           p.display_name AS oname, u.email::text AS oemail,
           (SELECT count(*) FROM public.trip_members m WHERE m.trip_id = t.id) AS nmembers,
           t.is_public AS tpublic, t.start_date AS tstart, t.end_date AS tend, t.created_at AS tcreated,
           (SELECT count(*) FROM public.stops s WHERE s.trip_id = t.id) AS nstops,
           (SELECT count(*) FROM public.expenses e WHERE e.trip_id = t.id) AS nexpenses,
           (SELECT count(*) FROM public.documents d WHERE d.trip_id = t.id) AS ndocs
    FROM public.trips t
    LEFT JOIN public.profiles p ON p.id = t.owner_id
    LEFT JOIN auth.users u ON u.id = t.owner_id
    WHERE p_search IS NULL OR trim(p_search) = ''
       OR t.title ILIKE '%' || trim(p_search) || '%'
       OR t.destination ILIKE '%' || trim(p_search) || '%'
       OR u.email ILIKE '%' || trim(p_search) || '%'
  )
  SELECT b.tid, b.ttitle, b.tdest, b.towner, b.oname, b.oemail, b.nmembers, b.tpublic, b.tstart, b.tend,
         b.tcreated, b.nstops, b.nexpenses, b.ndocs, count(*) OVER ()
  FROM base b
  WHERE p_filter = 'all' OR p_filter IS NULL
     OR (p_filter = 'public' AND b.tpublic)
     OR (p_filter = 'group' AND b.nmembers > 1)
     OR (p_filter = 'active' AND b.tstart <= current_date AND b.tend >= current_date)
     OR (p_filter = 'upcoming' AND b.tstart > current_date)
  ORDER BY b.tcreated DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100) OFFSET GREATEST(p_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_search TEXT DEFAULT NULL, p_entity TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID, created_at TIMESTAMPTZ, actor_id UUID, actor_name TEXT, actor_email TEXT, action TEXT,
  entity_type TEXT, entity_id UUID, trip_id UUID, trip_title TEXT, is_private BOOLEAN, metadata JSONB,
  total_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_guard();
  RETURN QUERY
  SELECT l.id, l.created_at, l.actor_id, p.display_name, u.email::text, l.action, l.entity_type, l.entity_id,
         l.trip_id, COALESCE(t.title, l.metadata->>'title'), l.is_private, l.metadata, count(*) OVER ()
  FROM public.audit_logs l
  LEFT JOIN public.profiles p ON p.id = l.actor_id
  LEFT JOIN auth.users u ON u.id = l.actor_id
  LEFT JOIN public.trips t ON t.id = l.trip_id
  WHERE (p_entity IS NULL OR p_entity = '' OR l.entity_type = p_entity)
    AND (p_search IS NULL OR trim(p_search) = ''
         OR l.action ILIKE '%' || trim(p_search) || '%'
         OR u.email ILIKE '%' || trim(p_search) || '%'
         OR p.display_name ILIKE '%' || trim(p_search) || '%'
         OR t.title ILIKE '%' || trim(p_search) || '%')
  ORDER BY l.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200) OFFSET GREATEST(p_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_admin(p_user UUID, p_grant BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_user = auth.uid() AND NOT p_grant THEN
    RAISE EXCEPTION 'You cannot remove your own admin access' USING ERRCODE = '42501';
  END IF;
  IF p_grant THEN
    INSERT INTO admin_users (user_id, granted_by) VALUES (p_user, auth.uid()) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM admin_users WHERE user_id = p_user;
  END IF;
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id)
  VALUES (auth.uid(), CASE WHEN p_grant THEN 'admin_granted' ELSE 'admin_revoked' END, 'user', p_user);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_suspended(p_user UUID, p_suspend BOOLEAN, p_reason TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot suspend yourself' USING ERRCODE = '42501';
  END IF;
  IF p_suspend AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = p_user) THEN
    RAISE EXCEPTION 'Remove admin access before suspending this user' USING ERRCODE = '42501';
  END IF;
  IF p_suspend THEN
    INSERT INTO user_suspensions (user_id, reason, suspended_by)
    VALUES (p_user, NULLIF(left(trim(p_reason), 500), ''), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, suspended_by = EXCLUDED.suspended_by, created_at = now();
  ELSE
    DELETE FROM user_suspensions WHERE user_id = p_user;
  END IF;
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_suspend THEN 'suspended' ELSE 'unsuspended' END, 'user', p_user,
          jsonb_build_object('reason', NULLIF(left(trim(p_reason), 500), '')));
END $$;

-- Moderation: take a public share link offline.
CREATE OR REPLACE FUNCTION public.admin_unpublish_trip(p_trip_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.admin_guard();
  UPDATE trips SET is_public = false WHERE id = p_trip_id;
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, trip_id)
  VALUES (auth.uid(), 'admin_unpublished', 'trips', p_trip_id, p_trip_id);
END $$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_guard()', 'public.admin_overview()', 'public.admin_report(INTEGER)',
    'public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER)', 'public.admin_list_trips(TEXT, TEXT, INTEGER, INTEGER)',
    'public.admin_list_audit(TEXT, TEXT, INTEGER, INTEGER)', 'public.admin_set_admin(UUID, BOOLEAN)',
    'public.admin_set_suspended(UUID, BOOLEAN, TEXT)', 'public.admin_unpublish_trip(UUID)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- =====================================================================
-- 9. REALTIME (RLS-filtered) — ignore "already member" errors
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['trips', 'trip_members', 'trip_invitations', 'itinerary_days', 'stops', 'expenses', 'expense_splits', 'member_budgets', 'packing_items', 'documents', 'audit_logs'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;
