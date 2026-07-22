-- 052_fix_missing_rls_policies.sql
-- Fixes a real bug in migration 050, caught in code review after it had
-- already merged: four tables (organizations, user_permissions,
-- client_team_assignments, project_team_assignments) have had
-- ENABLE ROW LEVEL SECURITY since migration 002 with NO matching
-- CREATE POLICY ever attached. RLS-enabled + zero policies denies ALL
-- access to the anon/authenticated role every API route uses — so if RLS
-- had actually been in effect on any of these four, the app would already
-- be broken. The fact the app works means RLS on these specific tables
-- never actually took hold in production. Migration 050 (re-issuing ENABLE
-- ROW LEVEL SECURITY on every table, meant to be a safe no-op) would have
-- flipped these four to deny-all the moment it ran, with no policy to let
-- legitimate requests back in.
--
-- This must be applied in the SAME "Apply database updates" click as (or
-- before) 050/051 — it adds the missing policies so enabling RLS on these
-- four tables is finally the safe no-op it was always supposed to be.

DROP POLICY IF EXISTS "organizations_org_isolation" ON organizations;
CREATE POLICY "organizations_org_isolation" ON organizations
  FOR ALL USING (id = get_user_org_id());

DROP POLICY IF EXISTS "user_permissions_org_isolation" ON user_permissions;
CREATE POLICY "user_permissions_org_isolation" ON user_permissions
  FOR ALL USING (organization_id = get_user_org_id());

DROP POLICY IF EXISTS "client_team_assignments_org_isolation" ON client_team_assignments;
CREATE POLICY "client_team_assignments_org_isolation" ON client_team_assignments
  FOR ALL USING (
    client_id IN (SELECT id FROM clients WHERE organization_id = get_user_org_id())
  );

DROP POLICY IF EXISTS "project_team_assignments_org_isolation" ON project_team_assignments;
CREATE POLICY "project_team_assignments_org_isolation" ON project_team_assignments
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_org_id())
  );
