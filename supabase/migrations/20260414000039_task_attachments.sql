-- Migration 39: Task file attachments
-- Adds an attachments JSONB column to delivery_tasks.
-- Each attachment: { name: string, url: string, size: number, type: string, uploaded_at: string }
-- Files are stored in the 'task-attachments' Supabase Storage bucket.
--
-- IMPORTANT: After running this migration, create the Storage bucket in Supabase Dashboard:
--   Storage → New Bucket → Name: "task-attachments" → Public: OFF (private)
--   Then add RLS policy: authenticated users can upload/read files in their own folder.

ALTER TABLE delivery_tasks
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
