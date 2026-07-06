-- Run this in Supabase SQL Editor

-- organization_settings: key-value store per org (used by QuickBooks, Google, etc.)
CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key VARCHAR NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, key)
);

-- client_integrations: maps clients to external platform IDs
CREATE TABLE IF NOT EXISTS client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  platform VARCHAR NOT NULL,
  external_id VARCHAR,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, platform)
);

-- masters: central dropdown value management with approval flow
CREATE TABLE IF NOT EXISTS masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR NOT NULL,
  value VARCHAR NOT NULL,
  label VARCHAR NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  approval_status VARCHAR DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, category, value)
);

-- Seed default masters for a freshly created org (apply per org as needed)
-- Industries
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'industry', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES
  ('Restaurant / Food & Beverage'),
  ('Retail / E-commerce'),
  ('Healthcare / Medical'),
  ('Legal / Law Firm'),
  ('Real Estate'),
  ('Construction / Contractor'),
  ('Finance / Accounting'),
  ('Technology / SaaS'),
  ('Consulting / Professional Services'),
  ('Education'),
  ('Non-Profit'),
  ('Automotive'),
  ('Beauty / Salon / Spa'),
  ('Entertainment / Events'),
  ('Travel / Hospitality'),
  ('Home Services / Plumbing / HVAC'),
  ('Other')
) AS vals(v)
ON CONFLICT DO NOTHING;

-- Project statuses
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'project_status', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES
  ('in_onboarding'),('active'),('prospect'),('on_hold'),('completed'),('cancelled')
) AS vals(v)
ON CONFLICT DO NOTHING;

-- Goals
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'goal', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES
  ('Increase Website Traffic'),('Generate Leads'),('Improve Local Search Rankings'),
  ('Improve National Search Rankings'),('Brand Awareness'),('Social Media Growth'),
  ('Increase Online Sales / Revenue'),('Improve Online Reputation'),('Product Launch'),('Event Promotion')
) AS vals(v)
ON CONFLICT DO NOTHING;

-- Stakeholder expectations
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'expectation', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES
  ('Monthly Ranking Report'),('Monthly Traffic Report'),('Monthly Leads Report'),
  ('Bi-weekly Check-in Call'),('Weekly Status Update Email'),('Quarterly Strategy Review'),
  ('Monthly Social Media Report'),('Custom Dashboard Access')
) AS vals(v)
ON CONFLICT DO NOTHING;

-- Billing terms
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'billing_term', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES ('Monthly'),('Quarterly'),('Annual'),('One-time')) AS vals(v)
ON CONFLICT DO NOTHING;

-- Contract terms
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'contract_term', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES ('Month-to-month'),('3 Months'),('6 Months'),('12 Months'),('24 Months')) AS vals(v)
ON CONFLICT DO NOTHING;

-- Client priority/degree
INSERT INTO masters (organization_id, category, value, label, sort_order, approval_status)
SELECT id, 'client_degree', v, v, row_number() OVER (), 'approved'
FROM organizations,
(VALUES ('vip'),('important'),('regular'),('inactive')) AS vals(v)
ON CONFLICT DO NOTHING;
