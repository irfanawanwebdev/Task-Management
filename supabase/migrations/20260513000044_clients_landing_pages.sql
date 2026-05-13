-- Add landing_pages JSONB column to clients table
-- Stores an array of { id, name, url, username, password, notes } objects

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS landing_pages jsonb NOT NULL DEFAULT '[]'::jsonb;
