-- Migration 50: Ensure notes_select policy is correct after migration 49 fixes.
-- Previous migration runs may have left the policy in an inconsistent state.

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

-- Also ensure update policy has explicit WITH CHECK so visibility changes persist
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
