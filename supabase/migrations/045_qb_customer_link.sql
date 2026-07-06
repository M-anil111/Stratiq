-- 045_qb_customer_link.sql
-- Ensures the QuickBooks customer link column exists on clients so the
-- "Import all customers & contacts from QuickBooks" feature can upsert
-- idempotently (match by stored QB id, else company_name/email).
-- Idempotent and safe to re-run. The column was originally introduced in
-- migration 036; this re-asserts it for databases that skipped it.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id text;
CREATE INDEX IF NOT EXISTS idx_clients_qb_customer_id ON clients(qb_customer_id);
