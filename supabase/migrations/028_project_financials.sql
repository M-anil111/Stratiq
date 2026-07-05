-- 028_project_financials.sql
-- QuickBooks-style project financials: attribute invoices to projects and
-- add QB-like project metadata fields. All statements are IF NOT EXISTS so
-- this migration is safe to re-run and tolerant of prior partial state.

-- Attribute an invoice to a project (nullable FK).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);

-- QuickBooks-style project fields.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;
