-- 046_enable_rls_public_tables.sql
-- SECURITY FIX (rls_disabled_in_public): several public tables shipped without
-- Row-Level Security enabled, so anyone with the project URL could read/edit/
-- delete their rows. Enable RLS + add org-scoped policies on every one of them.
-- Idempotent: safe to run repeatedly.

-- Helper predicate used throughout:
--   organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())

-- ---------------------------------------------------------------------------
-- Tables that carry organization_id directly
-- ---------------------------------------------------------------------------
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_organization_settings" ON organization_settings;
CREATE POLICY "org_organization_settings" ON organization_settings FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

ALTER TABLE masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_masters" ON masters;
CREATE POLICY "org_masters" ON masters FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_client_integrations" ON client_integrations;
CREATE POLICY "org_client_integrations" ON client_integrations FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

ALTER TABLE google_drive_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_google_drive_files" ON google_drive_files;
CREATE POLICY "org_google_drive_files" ON google_drive_files FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

ALTER TABLE upsell_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_upsell_analytics" ON upsell_analytics;
CREATE POLICY "org_upsell_analytics" ON upsell_analytics FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Tables without organization_id — scoped through their client's organization
-- ---------------------------------------------------------------------------
ALTER TABLE client_portal_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_client_portal_access" ON client_portal_access;
CREATE POLICY "org_client_portal_access" ON client_portal_access FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM clients WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM clients WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  ));

ALTER TABLE upsell_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_upsell_dismissals" ON upsell_dismissals;
CREATE POLICY "org_upsell_dismissals" ON upsell_dismissals FOR ALL TO authenticated
  USING (client_id IN (
    SELECT id FROM clients WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  ))
  WITH CHECK (client_id IN (
    SELECT id FROM clients WHERE organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  ));
