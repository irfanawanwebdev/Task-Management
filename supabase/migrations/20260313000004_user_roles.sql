-- Migration 4: user_roles table
-- Junction table — a user can hold multiple roles (e.g. owner + project_manager)

CREATE TABLE IF NOT EXISTS user_roles (
  id       UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role     app_role NOT NULL,

  CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role)
);

-- Index for fast role lookups in has_role() and RLS policies
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);
