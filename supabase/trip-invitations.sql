-- Apply in Supabase SQL editor to enable private trip invitations.
CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, email)
);
ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage trip invitations" ON public.trip_invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = trip_invitations.trip_id AND tm.user_id = auth.uid() AND tm.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = trip_invitations.trip_id AND tm.user_id = auth.uid() AND tm.role = 'owner'));

-- Travelers can see one another's names and avatars anywhere within their shared trips.
CREATE POLICY "Travelers can view shared trip profiles" ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trip_members mine
    JOIN public.trip_members theirs ON theirs.trip_id = mine.trip_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = profiles.id
  ));

CREATE OR REPLACE FUNCTION public.accept_trip_invitations()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE accepted INTEGER;
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role)
  SELECT i.trip_id, auth.uid(), i.role
  FROM public.trip_invitations i
  JOIN auth.users u ON u.id = auth.uid()
  WHERE lower(i.email) = lower(u.email)
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  GET DIAGNOSTICS accepted = ROW_COUNT;
  DELETE FROM public.trip_invitations i
  USING auth.users u
  WHERE u.id = auth.uid() AND lower(i.email) = lower(u.email);
  RETURN accepted;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_trip_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trip_invitations() TO authenticated;

-- Add an already registered Supabase user directly by email.
-- Returns false only when the email has no account yet.
CREATE OR REPLACE FUNCTION public.add_registered_trip_member(p_trip_id UUID, p_email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_user UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the trip owner can add travelers';
  END IF;

  SELECT id INTO target_user
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF target_user IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (p_trip_id, target_user, 'editor')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.add_registered_trip_member(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_registered_trip_member(UUID, TEXT) TO authenticated;
