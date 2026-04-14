-- Migration 37: Add guests to meetings
-- guests: JSONB array of { name: string, email: string }
-- Enables showing guest names + sending invite emails when a meeting is created.

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS guests jsonb NOT NULL DEFAULT '[]'::jsonb;
