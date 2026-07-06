-- Lead pipeline (prospect -> proposal -> won/lost) feeding into clients
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN ('prospect', 'contacted', 'proposal_sent', 'won', 'lost')),
  estimated_value NUMERIC,
  notes TEXT,
  converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_leads" ON leads
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
