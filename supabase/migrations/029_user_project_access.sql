-- User project access scoping (SE Ranking-style: grant access to ALL projects or SPECIFIC projects)
-- A user (team member/manager or client) with project_access = 'specific' can only see
-- the projects listed in user_project_access.

-- 1. Scope flag on the users table: 'all' | 'specific'
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_access TEXT DEFAULT 'all';

-- 2. Which specific projects a user can access when project_access = 'specific'
CREATE TABLE IF NOT EXISTS user_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_project_access_org ON user_project_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_project_access_user ON user_project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_access_project ON user_project_access(project_id);

ALTER TABLE user_project_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_user_project_access" ON user_project_access
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- 3. Remember the scoping chosen at invite time so it can be applied on acceptance
ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS project_access TEXT;
ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS project_ids UUID[];
