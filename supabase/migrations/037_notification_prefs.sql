-- HubSpot-style notification preferences center: per-user JSON map of topic → channel toggles.
-- Extends the existing user_notification_prefs table with a jsonb `prefs` column and an
-- optional organization_id for org-scoping. Everything is additive and idempotent.

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS organization_id UUID;
