-- Migration 43: Add attendees column to meetings
-- Free-text list of who attended (e.g. "John Smith, Jane Doe, Client Name")
-- source_integration: reserved for future Zoom/Otter/Fathom auto-import

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS attendees          TEXT,
  ADD COLUMN IF NOT EXISTS source_integration TEXT;
