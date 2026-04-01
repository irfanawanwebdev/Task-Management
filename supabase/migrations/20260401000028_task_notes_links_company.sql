-- Migration 28: extend personal_tasks and delivery_tasks
--
-- personal_tasks:
--   company       text  — optional company/context label (private to task owner)
--   assignee_note text  — optional name of who this is for (private, no FK)
--
-- delivery_tasks:
--   notes   text   — freeform notes / output documentation
--   links   jsonb  — array of {label, url} objects

ALTER TABLE personal_tasks
  ADD COLUMN IF NOT EXISTS company       text,
  ADD COLUMN IF NOT EXISTS assignee_note text;

ALTER TABLE delivery_tasks
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;
