-- Migration 24: Delete RLS policies for account_manager role
-- Allows account_managers to delete clients and delivery_tasks (in addition to owner/PM who already have full CRUD)

-- ─── clients: account_manager delete ─────────────────────────────────────────

DROP POLICY IF EXISTS "clients_delete_am" ON clients;
CREATE POLICY "clients_delete_am"
  ON clients FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'account_manager'));

-- ─── delivery_tasks: account_manager delete ───────────────────────────────────

DROP POLICY IF EXISTS "delivery_tasks_delete_am" ON delivery_tasks;
CREATE POLICY "delivery_tasks_delete_am"
  ON delivery_tasks FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'account_manager'));
