-- Migration 31: bridge fix
--
-- Migration 28 was already applied to the DB with `assignee_note text`.
-- We later renamed it to `assignees jsonb` in the migration file, but the DB
-- still has the old column. This migration brings the DB in sync.

ALTER TABLE personal_tasks
  ADD COLUMN IF NOT EXISTS assignees jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE personal_tasks
  DROP COLUMN IF EXISTS assignee_note;
