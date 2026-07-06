-- Social publishing accounts: HubSpot-style connection manager for
-- Facebook / Instagram / LinkedIn / TikTok / X / YouTube.
-- Access/refresh tokens are stored ENCRYPTED by the app (lib/encryption.ts) —
-- never plaintext. RLS org-scoped (pattern from migration 023).
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','linkedin','tiktok','x','youtube')),
  account_name TEXT,
  account_handle TEXT,
  external_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'connected',
  connected_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_org ON social_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_social_accounts" ON social_accounts;
CREATE POLICY "org_social_accounts" ON social_accounts
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
