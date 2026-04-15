-- Migration 40: Sync existing Blocked tasks → blockers table
-- Tasks that are currently Blocked but have no open blocker record get one inserted.
-- Safe to run multiple times (INSERT ... WHERE NOT EXISTS).

INSERT INTO blockers (client_id, task_id, workstream, description, severity, status, created_date)
SELECT
  t.client_id,
  t.id                                AS task_id,
  t.workstream,
  'Blocked: ' || t.task_name          AS description,
  'Med'                               AS severity,
  'Open'                              AS status,
  COALESCE(t.updated_at::date, now()::date) AS created_date
FROM delivery_tasks t
WHERE t.status = 'Blocked'
  AND NOT EXISTS (
    SELECT 1 FROM blockers b
    WHERE b.task_id = t.id
      AND b.status IN ('Open', 'In Progress')
  );
