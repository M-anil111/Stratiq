-- 035_seo_rank_tracking.sql
-- SEO keyword rank tracking (SE Ranking style): track keywords per project and
-- their ranking positions over time, entered/updated manually (no SERP API).
-- Tolerant/idempotent so it is safe to re-run.

-- Tracked keywords per project
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_engine TEXT DEFAULT 'google',
  location TEXT,
  target_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keywords_project ON keywords(project_id);
CREATE INDEX IF NOT EXISTS idx_keywords_org ON keywords(organization_id);

ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_keywords" ON keywords;
CREATE POLICY "org_keywords" ON keywords
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Ranking position history per keyword
CREATE TABLE IF NOT EXISTS keyword_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER,
  checked_on DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword ON keyword_rankings(keyword_id);
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_org ON keyword_rankings(organization_id);

ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_keyword_rankings" ON keyword_rankings;
CREATE POLICY "org_keyword_rankings" ON keyword_rankings
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );
