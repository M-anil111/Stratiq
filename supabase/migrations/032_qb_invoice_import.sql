-- 032_qb_invoice_import.sql
-- Track the source QuickBooks invoice id when importing invoices FROM QuickBooks
-- into Stratiq. Tolerant/idempotent so it is safe to re-run.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id text;
CREATE INDEX IF NOT EXISTS idx_invoices_qb_invoice_id ON invoices(qb_invoice_id);
