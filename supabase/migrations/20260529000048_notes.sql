-- Migration 48: Notes feature
-- Personal notes (private to creator), Global notes (team-wide), per-user sharing

CREATE TABLE public.notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT '',
  content     TEXT        NOT NULL DEFAULT '',
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  visibility  TEXT        NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal', 'global')),
  pinned      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.note_shares (
  note_id      UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_with  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, shared_with)
);

CREATE INDEX idx_notes_created_by   ON public.notes(created_by);
CREATE INDEX idx_notes_updated_at   ON public.notes(updated_at DESC);
CREATE INDEX idx_note_shares_shared ON public.note_shares(shared_with);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Notes: creator sees all their own; everyone sees global; shared_with sees shared
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

CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Note shares: creator can manage; shared_with can see
CREATE POLICY "note_shares_select" ON public.note_shares
  FOR SELECT TO authenticated
  USING (
    shared_with = auth.uid()
    OR EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND created_by = auth.uid())
  );

CREATE POLICY "note_shares_insert" ON public.note_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND created_by = auth.uid())
  );

CREATE POLICY "note_shares_delete" ON public.note_shares
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.notes WHERE id = note_id AND created_by = auth.uid())
  );

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes       TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.note_shares TO authenticated;
