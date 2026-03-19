-- Migration 20: Add year_number to weekly_reviews for year-aware uniqueness
-- Without year, week_number 12 of 2026 and 2027 would collide.

ALTER TABLE weekly_reviews
  ADD COLUMN IF NOT EXISTS year_number SMALLINT NOT NULL DEFAULT 0;

-- Backfill year for any existing rows
UPDATE weekly_reviews
  SET year_number = EXTRACT(YEAR FROM review_date)::SMALLINT
  WHERE year_number = 0;

-- Drop the old year-unaware unique constraint
ALTER TABLE weekly_reviews
  DROP CONSTRAINT IF EXISTS weekly_reviews_client_week_unique;

-- Replace with year-aware constraint
ALTER TABLE weekly_reviews
  ADD CONSTRAINT weekly_reviews_client_year_week_unique
  UNIQUE (client_id, year_number, week_number);
