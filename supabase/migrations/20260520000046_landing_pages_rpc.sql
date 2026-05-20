-- RPC to update a client's landing_pages JSONB column.
-- Uses SECURITY DEFINER to bypass RLS, since the calling user may be
-- a PM/owner whose role isn't yet in user_roles (bootstrapping edge case).
-- Requires the caller to be authenticated; no anonymous access.

CREATE OR REPLACE FUNCTION update_client_landing_pages(
  _client_id UUID,
  _pages     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'update_client_landing_pages: not authenticated.';
  END IF;

  UPDATE clients
  SET    landing_pages = _pages,
         updated_at    = now()
  WHERE  id = _client_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION update_client_landing_pages(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION update_client_landing_pages(UUID, JSONB) TO authenticated;
