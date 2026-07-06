ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_name VARCHAR;
-- Unique constraint: company_name must be unique per org
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_company_name_org_unique;
ALTER TABLE clients ADD CONSTRAINT clients_company_name_org_unique UNIQUE (organization_id, company_name);
