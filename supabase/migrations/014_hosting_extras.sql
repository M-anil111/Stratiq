-- Run this in Supabase SQL Editor
-- Adds extra hosting and support fields to clients

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR,
  ADD COLUMN IF NOT EXISTS support_type VARCHAR;

-- notification_emails key in organization_settings is used by the clients API
-- to know who to email when a new client is created.
-- No schema change needed — it uses the existing organization_settings table.
-- To set it, insert/upsert:
-- INSERT INTO organization_settings (organization_id, key, value)
-- VALUES ('<your-org-id>', 'notification_emails', 'email1@example.com,email2@example.com')
-- ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value;
