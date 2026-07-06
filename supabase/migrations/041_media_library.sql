-- ============================================================
-- 041_media_library.sql
-- Reusable media/asset library. Assets live in Google Drive (the org's chosen
-- storage); these rows are lightweight metadata + the Drive reference, so the
-- DB stays small. This is the persistent library — distinct from the transient
-- per-post media that the publisher reaps after a successful publish.
-- Idempotent.
-- ============================================================
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  drive_file_id TEXT,
  name TEXT,
  url TEXT,
  mime_type TEXT,
  kind TEXT,                       -- 'image' | 'video'
  bytes BIGINT,
  width INT,
  height INT,
  folder TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_org ON media_assets(organization_id);
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_media_assets" ON media_assets;
CREATE POLICY "org_media_assets" ON media_assets
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
