-- ============================================================
-- 042_report_definitions.sql
-- Custom report builder + scheduled auto-send persistence.
--   report_definitions: saved custom reports (blocks: metric/dimension +
--     per-block visualization, date range, name).
--   report_schedules:   auto-email schedules (weekly|monthly, recipients,
--     optional link to a saved report definition or a built-in report type).
-- Fully idempotent. Both tables are org-scoped with RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  -- Array of blocks: [{ id, title, metric, dimension, viz: 'table'|'line'|'bar'|'pie' }]
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Date range config: { preset, start, end, compare }
  date_range JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_definitions_org ON report_definitions(organization_id);
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_report_definitions" ON report_definitions;
CREATE POLICY "org_report_definitions" ON report_definitions
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT,
  report_type TEXT,                       -- built-in report label, e.g. 'Marketing Summary'
  report_definition_id UUID,              -- optional link to a saved custom report
  frequency TEXT NOT NULL DEFAULT 'monthly', -- 'weekly' | 'monthly'
  day TEXT,                               -- day-of-week (weekly) or day-of-month (monthly)
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'paused'
  last_sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON report_schedules(organization_id);
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_report_schedules" ON report_schedules;
CREATE POLICY "org_report_schedules" ON report_schedules
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
