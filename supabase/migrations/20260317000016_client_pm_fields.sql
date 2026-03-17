-- Migration 16: Add account_manager_name to clients table
-- owner_pm (text) already exists as a name field from migration 8.
-- Adding account_manager_name as a text name field to match the People-First naming approach (§8.1).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS account_manager_name text;

COMMENT ON COLUMN clients.owner_pm IS
  'Full name of the Owner PM assigned to this client (name-first, per §3.2)';

COMMENT ON COLUMN clients.account_manager_name IS
  'Full name of the Account Manager assigned to this client (name-first, per §3.2)';
