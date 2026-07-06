-- QB Products & Services cache (pulled from QuickBooks)
CREATE TABLE IF NOT EXISTS qb_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  qb_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- Service, NonInventory, Inventory
  unit_price NUMERIC(12,2) DEFAULT 0,
  sku TEXT,
  income_account_id TEXT,
  income_account_name TEXT,
  active BOOLEAN DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, qb_id)
);

ALTER TABLE qb_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_qb_items" ON qb_items USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Invoices (Stratiq-native, synced to QB)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  qb_invoice_id TEXT, -- QB Id after push
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'voided')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_invoices" ON invoices USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Index for fast client invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_qb_items_org ON qb_items(organization_id);
