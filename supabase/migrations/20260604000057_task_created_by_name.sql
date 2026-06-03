-- Migration 57: Add created_by_name text column to delivery_tasks
-- Stores a free-text creator label: full name for UI-created tasks, "Claude AI" for AI-created tasks.
-- Complements the existing created_by UUID column (which requires a real auth.users entry).

ALTER TABLE public.delivery_tasks
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;
