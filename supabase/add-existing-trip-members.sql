-- Apply this if trip-invitations.sql was already run before existing-account support was added.
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

  SELECT id INTO target_user FROM auth.users
  WHERE lower(email) = lower(trim(p_email)) LIMIT 1;

  IF target_user IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (p_trip_id, target_user, 'editor')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.add_registered_trip_member(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_registered_trip_member(UUID, TEXT) TO authenticated;
