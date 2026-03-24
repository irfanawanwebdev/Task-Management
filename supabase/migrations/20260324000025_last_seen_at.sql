-- Migration 25: Add last_seen_at to profiles for user activity tracking

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Allow users to update their own last_seen_at
DROP POLICY IF EXISTS "profiles_update_last_seen" ON profiles;
CREATE POLICY "profiles_update_last_seen"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
