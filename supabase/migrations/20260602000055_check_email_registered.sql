-- Migration 55: Add check_email_registered function
-- Used by the forgot-password form to verify the email belongs to a registered
-- user before sending the reset link, preventing misleading "email sent" messages.

CREATE OR REPLACE FUNCTION public.check_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = lower(trim(p_email))
      AND deleted_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_registered(TEXT) TO anon, authenticated;
