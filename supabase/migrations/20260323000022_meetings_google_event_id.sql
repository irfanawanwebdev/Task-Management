-- Migration 22: Add google_event_id to meetings for tracking created Calendar events

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;
