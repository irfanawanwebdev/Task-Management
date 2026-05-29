-- Migration 51: Note edit requests
-- Allows non-owners to request edit access on global/shared notes.
-- Owner approves/denies via notification + Notes panel.

-- ── Extend notification_type enum ─────────────────────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'note_edit_request';

-- ── note_edit_requests ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.note_edit_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  requester_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL DEFAULT '',   -- denormalised for cheap display
  note_owner     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'denied')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (note_id, requester_id)
);

CREATE INDEX IF NOT EXISTS idx_note_edit_req_note    ON public.note_edit_requests(note_id);
CREATE INDEX IF NOT EXISTS idx_note_edit_req_owner   ON public.note_edit_requests(note_owner);
CREATE INDEX IF NOT EXISTS idx_note_edit_req_requester ON public.note_edit_requests(requester_id);

ALTER TABLE public.note_edit_requests ENABLE ROW LEVEL SECURITY;

-- Requester sees own requests; owner sees all requests for their notes
CREATE POLICY "note_edit_req_select" ON public.note_edit_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR note_owner = auth.uid());

-- Only the requester can create a request for themselves
CREATE POLICY "note_edit_req_insert" ON public.note_edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Only the owner can approve / deny
CREATE POLICY "note_edit_req_update" ON public.note_edit_requests
  FOR UPDATE TO authenticated
  USING (note_owner = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.note_edit_requests TO authenticated;

-- ── Add can_edit to note_shares ───────────────────────────────────────────────
ALTER TABLE public.note_shares ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT false;

-- Owner needs UPDATE on note_shares to flip can_edit on approval
DROP POLICY IF EXISTS "note_shares_update" ON public.note_shares;
CREATE POLICY "note_shares_update" ON public.note_shares
  FOR UPDATE TO authenticated
  USING (note_owner = auth.uid())
  WITH CHECK (note_owner = auth.uid());

GRANT UPDATE ON public.note_shares TO authenticated;

-- ── Allow approved editors to UPDATE note content ─────────────────────────────
-- Approved editors (can_edit = true in note_shares) can update title/content/tags.
-- Owner still controls visibility/pinned (enforced in the UI, not here).
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.note_shares
      WHERE note_id = notes.id
        AND shared_with = auth.uid()
        AND can_edit = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.note_shares
      WHERE note_id = notes.id
        AND shared_with = auth.uid()
        AND can_edit = true
    )
  );
