-- Migration 56: Add created_by to delivery_tasks
-- Tracks which user created each task so team members know who to ask for context.

ALTER TABLE public.delivery_tasks
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
