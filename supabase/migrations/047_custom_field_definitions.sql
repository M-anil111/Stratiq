-- 047_custom_field_definitions.sql
-- Custom Fields feature (settings/custom-fields) had a UI + API but no table —
-- every save silently 503'd. Add the missing table + storage columns.

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox')),
  required BOOLEAN DEFAULT false,
  entity_type TEXT NOT NULL DEFAULT 'client' CHECK (entity_type IN ('client', 'project')),
  options JSONB DEFAULT '[]'::jsonb,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_org ON custom_field_definitions(organization_id, entity_type);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_custom_field_definitions" ON custom_field_definitions;
CREATE POLICY "org_custom_field_definitions" ON custom_field_definitions FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Per-record custom field values, stored as {definition_id: value}.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb;
