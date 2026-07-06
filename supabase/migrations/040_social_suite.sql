-- ============================================================
-- 040_social_suite.sql
-- Full social scheduling suite (Hootsuite/Buffer/Later-style).
--
-- Adds the scheduling lifecycle + engagement columns that the composer,
-- calendar, publisher and reports depend on; posting slots (queue);
-- a lightweight published-post reference table (space-conscious — the
-- heavy scheduling row + media are deleted after a successful publish);
-- an in-app notification system; and social_accounts reconnect fields.
--
-- Idempotent: safe to run repeatedly.
-- ============================================================

-- ---------- social_media_postings: lifecycle + engagement ----------
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS post_content TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS media_drive_file_ids TEXT[] DEFAULT '{}';
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS first_comment TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS social_account_id UUID;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS external_post_id TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS permalink TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS failed_reason TEXT;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS boost JSONB;
-- Engagement metrics (so analytics aren't always zero).
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS likes INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS shares INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS impressions INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS reach INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS clicks INT DEFAULT 0;
ALTER TABLE social_media_postings ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMPTZ;

-- Relax the base status / type CHECK constraints to cover the full lifecycle.
ALTER TABLE social_media_postings DROP CONSTRAINT IF EXISTS social_media_postings_status_check;
ALTER TABLE social_media_postings ADD CONSTRAINT social_media_postings_status_check
  CHECK (status IN (
    'draft','pending_approval','approved','scheduled','publishing',
    'published','failed','live','under_review','deleted'
  ));

ALTER TABLE social_media_postings DROP CONSTRAINT IF EXISTS social_media_postings_type_check;
ALTER TABLE social_media_postings ADD CONSTRAINT social_media_postings_type_check
  CHECK (type IN ('image','video','carousel','gif','story','reel','text','link'));

CREATE INDEX IF NOT EXISTS idx_smp_status ON social_media_postings(status);
CREATE INDEX IF NOT EXISTS idx_smp_scheduled ON social_media_postings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_smp_org ON social_media_postings(organization_id);

-- ---------- posting_slots: recurring queue times ----------
CREATE TABLE IF NOT EXISTS posting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  social_account_id UUID,
  platform TEXT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  time_of_day TEXT NOT NULL,           -- 'HH:MM' 24h local
  timezone TEXT DEFAULT 'UTC',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posting_slots_org ON posting_slots(organization_id);
ALTER TABLE posting_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_posting_slots" ON posting_slots;
CREATE POLICY "org_posting_slots" ON posting_slots
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- ---------- social_published_posts: space-conscious archive ----------
-- After a post publishes successfully the heavy scheduling row and its media
-- are removed; this lightweight reference is what remains, and live details
-- are re-fetched from the platform API on demand.
CREATE TABLE IF NOT EXISTS social_published_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  project_id UUID,
  social_account_id UUID,
  platform TEXT NOT NULL,
  external_post_id TEXT,
  permalink TEXT,
  content_snippet TEXT,               -- short preview only (space)
  published_at TIMESTAMPTZ DEFAULT now(),
  -- last-known metrics snapshot (refreshed from the API when viewed)
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares INT DEFAULT 0,
  impressions INT DEFAULT 0,
  reach INT DEFAULT 0,
  clicks INT DEFAULT 0,
  metrics_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spp_org ON social_published_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_spp_published ON social_published_posts(published_at);
ALTER TABLE social_published_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_social_published_posts" ON social_published_posts;
CREATE POLICY "org_social_published_posts" ON social_published_posts
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- ---------- notifications: in-app notification system ----------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',   -- publish_failed, publish_success, token_expiry, reconnect, report, info
  severity TEXT NOT NULL DEFAULT 'info', -- info, success, warning, error
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_notifications" ON notifications;
CREATE POLICY "own_notifications" ON notifications
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- ---------- social_accounts: reconnect + per-client + more networks ----------
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN DEFAULT false;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS scopes TEXT;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE social_accounts DROP CONSTRAINT IF EXISTS social_accounts_platform_check;
ALTER TABLE social_accounts ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform IN ('facebook','instagram','linkedin','tiktok','x','youtube','threads','bluesky','pinterest'));

-- ---------- user dashboard layout (customizable dashboard) ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_layout JSONB;
-- theme preference: 'light' | 'dark' | 'system'
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference TEXT;
