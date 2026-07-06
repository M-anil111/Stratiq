-- Team invites (HubSpot-style user management: bulk invites, resend, revoke)
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'team_member',
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Only one pending invite per email per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_org_email_pending
  ON team_invites(organization_id, email) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_invites_org ON team_invites(organization_id);

ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_team_invites" ON team_invites
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
