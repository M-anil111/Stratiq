-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE offpage_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onpage_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE directory_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's org
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Users: can see users in their org
CREATE POLICY "users_org_isolation" ON users
  FOR ALL USING (organization_id = get_user_org_id() OR id = auth.uid());

-- Clients: staff see all in their org
CREATE POLICY "clients_org_isolation" ON clients
  FOR ALL USING (organization_id = get_user_org_id());

-- Projects: staff in same org
CREATE POLICY "projects_org_isolation" ON projects
  FOR ALL USING (organization_id = get_user_org_id());

-- Activity tables: same org
CREATE POLICY "social_postings_org" ON social_media_postings
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "offpage_org" ON offpage_submissions
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "blog_org" ON blog_submissions
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "onpage_org" ON onpage_details
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "group_postings_org" ON group_postings
  FOR ALL USING (organization_id = get_user_org_id());

-- Targets: same org
CREATE POLICY "targets_org" ON activity_targets
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "explanations_org" ON target_explanations
  FOR ALL USING (organization_id = get_user_org_id());

-- Reports: same org
CREATE POLICY "reports_org" ON marketing_reports
  FOR ALL USING (organization_id = get_user_org_id());

CREATE POLICY "custom_reports_org" ON custom_reports
  FOR ALL USING (organization_id = get_user_org_id());

-- Messages: same org
CREATE POLICY "messages_org" ON messages
  FOR ALL USING (organization_id = get_user_org_id());

-- Directory sites: same org
CREATE POLICY "directory_sites_org" ON directory_sites
  FOR ALL USING (organization_id = get_user_org_id());

-- Integrations: same org
CREATE POLICY "integrations_org" ON integrations
  FOR ALL USING (organization_id = get_user_org_id());

-- Audit log: admins can see all; users see their own
CREATE POLICY "audit_log_access" ON audit_log
  FOR SELECT USING (
    organization_id = get_user_org_id() AND (
      get_user_role() IN ('super_admin','admin','manager')
      OR user_id = auth.uid()
    )
  );

-- Login credentials: same org only, no delete via RLS (use soft delete)
CREATE POLICY "credentials_org" ON login_credentials
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_org_id())
  );

CREATE POLICY "social_accounts_org" ON social_media_accounts
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_org_id())
  );

CREATE POLICY "tracking_tools_org" ON tracking_tools
  FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE organization_id = get_user_org_id())
  );
