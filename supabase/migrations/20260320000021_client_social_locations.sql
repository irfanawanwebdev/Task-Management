-- Migration 21: Social media URL columns + client locations (parent/child)

-- ── Social media URLs ─────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS facebook_url  TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url   TEXT;

-- ── Client locations (parent-child relationship) ──────────────────────────────
-- parent_client_id: NULL = top-level client, non-NULL = location under a parent
-- location_name: short label e.g. "Los Angeles", "San Francisco"
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS location_name    TEXT;

-- Index for fast children lookup
CREATE INDEX IF NOT EXISTS clients_parent_client_id_idx ON clients (parent_client_id);

-- Existing RLS policies on `clients` apply to new columns automatically.
