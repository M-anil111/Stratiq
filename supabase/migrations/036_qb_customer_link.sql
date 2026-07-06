-- 036_qb_customer_link.sql
-- Store the QuickBooks Customer id on each Stratiq client so client↔QB-customer
-- matching is reliable (by stored id) instead of name-only matching.
-- Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id text;
CREATE INDEX IF NOT EXISTS idx_clients_qb_customer_id ON clients(qb_customer_id);
