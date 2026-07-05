-- Record merging support (HubSpot-style): merged id tracking + merge audit log.
-- Note: merges are NOT reversible (HubSpot behavior) — the log is an audit
-- trail, not an undo mechanism.

-- Track ids of client records that were merged into a surviving client
-- (HubSpot's "Merged record IDs" property equivalent)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS merged_client_ids uuid[] DEFAULT '{}';

-- Standalone contacts table (referenced by global search; created here if it
-- doesn't exist yet so merged_contact_ids has somewhere to live)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS merged_contact_ids uuid[] DEFAULT '{}';

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_contacts" ON contacts;
CREATE POLICY "org_contacts" ON contacts
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Audit log of merges (clients and contacts)
CREATE TABLE IF NOT EXISTS merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('client', 'contact')),
  primary_id UUID NOT NULL,
  secondary_id UUID NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  property_choices JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_log_org ON merge_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_primary ON merge_log(primary_id);

ALTER TABLE merge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_merge_log" ON merge_log;
CREATE POLICY "org_merge_log" ON merge_log
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
