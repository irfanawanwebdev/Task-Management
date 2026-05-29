-- Migration 53: Reassign the welcome note owner to Irfan's profile.

DO $$
DECLARE
  _irfan_id UUID;
BEGIN
  SELECT user_id INTO _irfan_id
  FROM public.profiles
  WHERE full_name ILIKE '%irfan%'
    AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF _irfan_id IS NULL THEN
    RAISE NOTICE 'No profile matching Irfan found — skipping reassignment.';
    RETURN;
  END IF;

  UPDATE public.notes
  SET created_by = _irfan_id,
      updated_at = now()
  WHERE title = '👋 Welcome to Team Notes';
END;
$$;
