-- 033_looker_studio.sql
-- Looker Studio (formerly Google Data Studio) integration.
-- Stores the published/shared Looker Studio report URL used to embed a
-- per-client dashboard via iframe. Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS looker_report_url text;
