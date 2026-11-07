-- Apply after v2-roles-privacy-admin.sql to allow signed-in travelers to join
-- a trip with its existing high-entropy share token (invite code).
CREATE OR REPLACE FUNCTION public.join_trip_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_trip UUID;
  join_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'signed_out', 'trip_id', NULL);
  END IF;
  IF public.is_suspended() THEN
    RETURN jsonb_build_object('status', 'suspended', 'trip_id', NULL);
  END IF;

  SELECT id INTO target_trip
  FROM public.trips
  WHERE share_token = lower(trim(p_code)) AND length(trim(p_code)) BETWEEN 12 AND 64;

  IF target_trip IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid_code', 'trip_id', NULL);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = target_trip AND user_id = auth.uid()
  ) THEN
    join_status := 'already_member';
  ELSE
    INSERT INTO public.trip_members (trip_id, user_id, role)
    VALUES (target_trip, auth.uid(), 'viewer')
    ON CONFLICT (trip_id, user_id) DO NOTHING;
    join_status := 'joined';
  END IF;

  RETURN jsonb_build_object('status', join_status, 'trip_id', target_trip);
END;
$$;

REVOKE ALL ON FUNCTION public.join_trip_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_trip_by_code(TEXT) TO authenticated;
