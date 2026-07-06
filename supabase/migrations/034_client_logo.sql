-- 034_client_logo.sql
-- Store a single primary logo URL for a client, auto-derived from their website
-- (Clearbit Logo API / Google favicon) in the add-client wizard.
-- The existing clients.logo_urls (jsonb array) is left untouched; this adds a
-- dedicated single-value column used for the auto-picked site logo.
-- Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text;
