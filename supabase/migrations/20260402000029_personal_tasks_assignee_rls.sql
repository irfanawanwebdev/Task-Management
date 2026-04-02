-- Migration 29: no-op
-- Originally intended to split personal_tasks RLS to allow assignees to view tasks.
-- This was reverted in migration 30 (owner-only is the correct behaviour).
-- Kept as a no-op to preserve migration history continuity.
SELECT 1;
