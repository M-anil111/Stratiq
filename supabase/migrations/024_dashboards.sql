-- Multi-dashboard system (HubSpot-style): named dashboards with jsonb widget arrays
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  access TEXT NOT NULL DEFAULT 'everyone_edit' CHECK (access IN ('private', 'everyone_view', 'everyone_edit')),
  is_default BOOLEAN DEFAULT false,
  favorited_by UUID[] DEFAULT '{}',
  widgets JSONB DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_deleted ON dashboards(deleted_at);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_dashboards" ON dashboards
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Change log for dashboards (who did what, when)
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_activity_org ON dashboard_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_dashboard ON dashboard_activity(dashboard_id, created_at DESC);

ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_dashboard_activity" ON dashboard_activity
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
