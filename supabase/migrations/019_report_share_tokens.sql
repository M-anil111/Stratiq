-- Shareable, token-based, read-only client report links
CREATE TABLE IF NOT EXISTS report_share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_share_tokens_token ON report_share_tokens(token);

ALTER TABLE report_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_report_share_tokens" ON report_share_tokens
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
