-- Migration 49: Fix RLS infinite recursion on note_shares.
--
-- The original note_shares policies referenced the notes table, which references
-- note_shares in its own SELECT policy → circular recursion.
-- Fix: drop and recreate note_shares with a denormalised note_owner column so
-- policies are self-contained (no join back to notes required).

-- Drop the notes_select policy first — it references note_shares, blocking the DROP TABLE
DROP POLICY IF EXISTS "notes_select" ON public.notes;

-- Drop old table (no real data yet — notes feature was broken)
DROP TABLE IF EXISTS public.note_shares;

CREATE TABLE public.note_shares (
  note_id      UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_with  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_owner   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_note_shares_shared ON public.note_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_note_shares_owner  ON public.note_shares(note_owner);

ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Policies: only check columns on note_shares itself — never JOIN back to notes.
DROP POLICY IF EXISTS "note_shares_select" ON public.note_shares;
CREATE POLICY "note_shares_select" ON public.note_shares
  FOR SELECT TO authenticated
  USING (shared_with = auth.uid() OR note_owner = auth.uid());

DROP POLICY IF EXISTS "note_shares_insert" ON public.note_shares;
CREATE POLICY "note_shares_insert" ON public.note_shares
  FOR INSERT TO authenticated
  WITH CHECK (note_owner = auth.uid());

DROP POLICY IF EXISTS "note_shares_delete" ON public.note_shares;
CREATE POLICY "note_shares_delete" ON public.note_shares
  FOR DELETE TO authenticated
  USING (note_owner = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.note_shares TO authenticated;

-- Restore notes_select policy (dropped above to unblock the DROP TABLE).
-- Querying note_shares here is safe now: note_shares policies no longer query back into notes.
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR visibility = 'global'
    OR EXISTS (
      SELECT 1 FROM public.note_shares
      WHERE note_id = notes.id AND shared_with = auth.uid()
    )
  );
