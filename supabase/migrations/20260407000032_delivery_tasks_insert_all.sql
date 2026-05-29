-- Migration 32: Allow all authenticated users to insert delivery tasks and task assignments.
-- Previously only PM/Owner could INSERT. This was too restrictive; specialists need
-- to be able to create tasks for their own work.

-- delivery_tasks: INSERT for all authenticated users
DROP POLICY IF EXISTS "delivery_tasks_insert_authenticated" ON delivery_tasks;
CREATE POLICY "delivery_tasks_insert_authenticated"
  ON delivery_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- task_assignments: INSERT for all authenticated users
-- (Needed so the CreateTaskDialog can save RACI assignments alongside the task)
DROP POLICY IF EXISTS "task_assignments_insert_authenticated" ON task_assignments;
CREATE POLICY "task_assignments_insert_authenticated"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (true);
