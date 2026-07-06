-- ============================================================
-- 038_user_permissions.sql
-- HubSpot-style granular per-user permissions.
-- Per-user granular overrides stored as a JSON map; NULL means
-- "use the role defaults" (see lib/permissions.ts). Overrides win
-- where present, merged over the role baseline.
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb;
