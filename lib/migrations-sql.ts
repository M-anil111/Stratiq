// AUTO-EMBEDDED from supabase/APPLY_ALL_PENDING.sql — do NOT read the .sql file at runtime.
// Bundled as a string so it ships with the Vercel deployment. Keep this in
// sync with supabase/APPLY_ALL_PENDING.sql every time a new migration is
// added — this is what Settings -> Database -> "Apply database updates"
// actually runs, so if this file is stale that button silently under-applies.

export const MIGRATIONS_VERSION = '052'

export const PENDING_MIGRATIONS_SQL = `-- ============================================================
-- Stratiq: combined pending migrations (010 through 031)
-- Paste this whole file into the Supabase SQL editor for project
-- sczvyujahydnsdlakwzh and click Run. Safe/idempotent (IF NOT EXISTS).
-- ============================================================

-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/010_client_hosting_contact.sql <<<<<<<<<<<<<<<<<<<<
-- Contact person fields (one person can own multiple businesses)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_first_name VARCHAR,
  ADD COLUMN IF NOT EXISTS contact_last_name VARCHAR;

-- Hosting & domain details
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS domain_name VARCHAR,
  ADD COLUMN IF NOT EXISTS domain_registrar VARCHAR,
  ADD COLUMN IF NOT EXISTS domain_expiry DATE,
  ADD COLUMN IF NOT EXISTS hosting_provider VARCHAR,
  ADD COLUMN IF NOT EXISTS hosting_expiry DATE,
  ADD COLUMN IF NOT EXISTS nameservers TEXT,
  ADD COLUMN IF NOT EXISTS hosting_notes TEXT;

-- Link multiple businesses to one contact person (optional)
-- e.g. Jay Mehta owns Mindshare Consulting, Jay Mehta Digital, Grab Tickets Now
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/011_display_name.sql <<<<<<<<<<<<<<<<<<<<
ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_name VARCHAR;
-- Unique constraint: company_name must be unique per org
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_company_name_org_unique;
ALTER TABLE clients ADD CONSTRAINT clients_company_name_org_unique UNIQUE (organization_id, company_name);


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/012_tasks_notes.sql <<<<<<<<<<<<<<<<<<<<
-- Client tasks
CREATE TABLE IF NOT EXISTS client_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_tasks" ON client_tasks USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Client notes / activity log
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'call', 'email', 'meeting', 'activity')),
  body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_notes" ON client_notes USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/013_qb_sync.sql <<<<<<<<<<<<<<<<<<<<
-- QB Products & Services cache (pulled from QuickBooks)
CREATE TABLE IF NOT EXISTS qb_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  qb_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- Service, NonInventory, Inventory
  unit_price NUMERIC(12,2) DEFAULT 0,
  sku TEXT,
  income_account_id TEXT,
  income_account_name TEXT,
  active BOOLEAN DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, qb_id)
);

ALTER TABLE qb_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_qb_items" ON qb_items USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Invoices (Stratiq-native, synced to QB)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  qb_invoice_id TEXT, -- QB Id after push
  invoice_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'voided')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_invoices" ON invoices USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
);

-- Index for fast client invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_qb_items_org ON qb_items(organization_id);


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/014_hosting_extras.sql <<<<<<<<<<<<<<<<<<<<
-- Run this in Supabase SQL Editor
-- Adds extra hosting and support fields to clients

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR,
  ADD COLUMN IF NOT EXISTS support_type VARCHAR;

-- notification_emails key in organization_settings is used by the clients API
-- to know who to email when a new client is created.
-- No schema change needed — it uses the existing organization_settings table.
-- To set it, insert/upsert:
-- INSERT INTO organization_settings (organization_id, key, value)
-- VALUES ('<your-org-id>', 'notification_emails', 'email1@example.com,email2@example.com')
-- ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/015_company_profile_fields.sql <<<<<<<<<<<<<<<<<<<<
-- Add extended company profile fields to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add preferences JSONB to user_notification_prefs to store all extra notification toggles
ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/016_invoice_status_timestamps.sql <<<<<<<<<<<<<<<<<<<<
-- Add sent_at and paid_at timestamps to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/017_social_tracking_extras.sql <<<<<<<<<<<<<<<<<<<<
-- Add access_level and status to social_media_accounts
ALTER TABLE social_media_accounts
  ADD COLUMN IF NOT EXISTS access_level TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add access_type, notes, url to tracking_tools
ALTER TABLE tracking_tools
  ADD COLUMN IF NOT EXISTS access_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/018_submission_enhancements.sql <<<<<<<<<<<<<<<<<<<<
-- Blog submissions: add new columns for redesigned UI
ALTER TABLE blog_submissions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS word_count INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS author TEXT;

-- Make old SEO-specific columns optional (nullable)
ALTER TABLE blog_submissions
  ALTER COLUMN live_url DROP NOT NULL,
  ALTER COLUMN meta_title DROP NOT NULL,
  ALTER COLUMN meta_description DROP NOT NULL,
  ALTER COLUMN h1 DROP NOT NULL;

-- Add check constraint for blog status
ALTER TABLE blog_submissions
  ADD CONSTRAINT blog_submissions_status_check CHECK (status IN ('draft', 'published', 'scheduled'));

-- Offpage submissions: add directory_site_id for directory dropdown
ALTER TABLE offpage_submissions
  ADD COLUMN IF NOT EXISTS directory_site_id UUID REFERENCES directory_sites(id),
  ADD COLUMN IF NOT EXISTS directory_name TEXT;

-- Extend status values for offpage
ALTER TABLE offpage_submissions DROP CONSTRAINT IF EXISTS offpage_submissions_status_check;
ALTER TABLE offpage_submissions ADD CONSTRAINT offpage_submissions_status_check
  CHECK (status IN ('live', 'under_review', 'deleted', 'pending', 'rejected'));


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/019_report_share_tokens.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/020_proposal_approval.sql <<<<<<<<<<<<<<<<<<<<
-- Proposal approval flow: one-click approve/reject links sent via email
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_token TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/021_invoice_payment_link.sql <<<<<<<<<<<<<<<<<<<<
-- Add Stripe payment link column to invoices
alter table invoices add column if not exists payment_link text;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/023_leads.sql <<<<<<<<<<<<<<<<<<<<
-- Lead pipeline (prospect -> proposal -> won/lost) feeding into clients
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  source TEXT,
  stage TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN ('prospect', 'contacted', 'proposal_sent', 'won', 'lost')),
  estimated_value NUMERIC,
  notes TEXT,
  converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_leads" ON leads
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/024_dashboards.sql <<<<<<<<<<<<<<<<<<<<
-- Multi-dashboard system (HubSpot-style): named dashboards with jsonb widget arrays
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  access TEXT NOT NULL DEFAULT 'everyone_edit' CHECK (access IN ('private', 'everyone_view', 'everyone_edit')),
  is_default BOOLEAN DEFAULT false,
  favorited_by UUID[] DEFAULT '{}',
  widgets JSONB DEFAULT '[]',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_deleted ON dashboards(deleted_at);

ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_dashboards" ON dashboards
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Change log for dashboards (who did what, when)
CREATE TABLE IF NOT EXISTS dashboard_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dashboard_id UUID REFERENCES dashboards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_activity_org ON dashboard_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_activity_dashboard ON dashboard_activity(dashboard_id, created_at DESC);

ALTER TABLE dashboard_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_dashboard_activity" ON dashboard_activity
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/025_merge_support.sql <<<<<<<<<<<<<<<<<<<<
-- Record merging support (HubSpot-style): merged id tracking + merge audit log.
-- Note: merges are NOT reversible (HubSpot behavior) — the log is an audit
-- trail, not an undo mechanism.

-- Track ids of client records that were merged into a surviving client
-- (HubSpot's "Merged record IDs" property equivalent)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS merged_client_ids uuid[] DEFAULT '{}';

-- Standalone contacts table (referenced by global search; created here if it
-- doesn't exist yet so merged_contact_ids has somewhere to live)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS merged_contact_ids uuid[] DEFAULT '{}';

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_contacts" ON contacts;
CREATE POLICY "org_contacts" ON contacts
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Audit log of merges (clients and contacts)
CREATE TABLE IF NOT EXISTS merge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('client', 'contact')),
  primary_id UUID NOT NULL,
  secondary_id UUID NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  property_choices JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merge_log_org ON merge_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_primary ON merge_log(primary_id);

ALTER TABLE merge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_merge_log" ON merge_log;
CREATE POLICY "org_merge_log" ON merge_log
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/026_team_invites.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/027_client_web_analytics.sql <<<<<<<<<<<<<<<<<<<<
-- Per-client Google Analytics (GA4) + Search Console linkage.
-- OAuth tokens stay org-level (organization_settings); here we only store
-- which GA4 property / GSC site each client is linked to.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga_property_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga_property_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/028_project_financials.sql <<<<<<<<<<<<<<<<<<<<
-- 028_project_financials.sql
-- QuickBooks-style project financials: attribute invoices to projects and
-- add QB-like project metadata fields. All statements are IF NOT EXISTS so
-- this migration is safe to re-run and tolerant of prior partial state.

-- Attribute an invoice to a project (nullable FK).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id);

-- QuickBooks-style project fields.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes TEXT;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/029_user_project_access.sql <<<<<<<<<<<<<<<<<<<<
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


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/030_helcim.sql <<<<<<<<<<<<<<<<<<<<
-- Helcim invoice payment support.
-- Reuses the existing invoices.payment_link column (added in 021) as the
-- hosted payment page URL; only adds the Helcim transaction id here.
alter table invoices add column if not exists helcim_transaction_id text;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/031_login_otp.sql <<<<<<<<<<<<<<<<<<<<
-- Step-up auth: one-time login verification codes.

CREATE TABLE IF NOT EXISTS login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_user_id ON login_otps(user_id);

ALTER TABLE login_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_select'
  ) THEN
    CREATE POLICY own_login_otps_select ON login_otps
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_insert'
  ) THEN
    CREATE POLICY own_login_otps_insert ON login_otps
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_update'
  ) THEN
    CREATE POLICY own_login_otps_update ON login_otps
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;




-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/032_qb_invoice_import.sql <<<<<<<<<<<<<<<<<<<<
-- 032_qb_invoice_import.sql
-- Track the source QuickBooks invoice id when importing invoices FROM QuickBooks
-- into Stratiq. Tolerant/idempotent so it is safe to re-run.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id text;
CREATE INDEX IF NOT EXISTS idx_invoices_qb_invoice_id ON invoices(qb_invoice_id);



-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/033_looker_studio.sql <<<<<<<<<<<<<<<<<<<<
-- Looker Studio (formerly Google Data Studio) integration.
-- Stores the published/shared Looker Studio report URL used to embed a
-- per-client dashboard via iframe. Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS looker_report_url text;



-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/034_client_logo.sql <<<<<<<<<<<<<<<<<<<<
-- 034_client_logo.sql
-- Store a single primary logo URL for a client, auto-derived from their website
-- (Clearbit Logo API / Google favicon) in the add-client wizard.
-- The existing clients.logo_urls (jsonb array) is left untouched; this adds a
-- dedicated single-value column used for the auto-picked site logo.
-- Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url text;



-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/036_qb_customer_link.sql <<<<<<<<<<<<<<<<<<<<
-- 036_qb_customer_link.sql
-- Store the QuickBooks Customer id on each Stratiq client so client↔QB-customer
-- matching is reliable (by stored id) instead of name-only matching.
-- Tolerant/idempotent so it is safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id text;
CREATE INDEX IF NOT EXISTS idx_clients_qb_customer_id ON clients(qb_customer_id);


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/035_seo_rank_tracking.sql <<<<<<<<<<<<<<<<<<<<
-- SEO keyword rank tracking (SE Ranking style): track keywords per project and
-- their ranking positions over time, entered/updated manually (no SERP API).
-- Tolerant/idempotent so it is safe to re-run.

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

-- ============================================================
-- 037_notification_prefs.sql
-- HubSpot-style notification preferences: per-user JSON map.
-- ============================================================
ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS prefs JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- ============================================================
-- 038_user_permissions.sql
-- HubSpot-style granular per-user permissions: per-user JSON
-- overrides. NULL = use role defaults (see lib/permissions.ts).
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb;

-- ============================================================
-- 039_social_accounts.sql
-- HubSpot-style social publishing connection manager. Tokens are
-- stored ENCRYPTED by the app (AES-256-GCM). RLS org-scoped.
-- ============================================================
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

-- ===== 043_notification_prefs.sql =====
-- Per-user notification preferences stored as a JSONB blob on the users row.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;


-- >>>>>>>>>>>>>>>>>>>> supabase/migrations/042_report_definitions.sql <<<<<<<<<<<<<<<<<<<<
-- Custom report builder + scheduled auto-send persistence. Idempotent, org-scoped, RLS.
CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_range JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_definitions_org ON report_definitions(organization_id);
ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_report_definitions" ON report_definitions;
CREATE POLICY "org_report_definitions" ON report_definitions
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT,
  report_type TEXT,
  report_definition_id UUID,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day TEXT,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  last_sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON report_schedules(organization_id);
ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_report_schedules" ON report_schedules;
CREATE POLICY "org_report_schedules" ON report_schedules
  FOR ALL TO authenticated USING (
    organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- 045_qb_customer_link.sql — QuickBooks customer link column for import-all
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id text;
CREATE INDEX IF NOT EXISTS idx_clients_qb_customer_id ON clients(qb_customer_id);

-- ============================================================================
-- 044_proofhub_mapping.sql — link Stratiq clients/projects to a ProofHub project
-- ============================================================================
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proofhub_project_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proofhub_project_id TEXT;

-- ============================================================================
-- 046_enable_rls_public_tables.sql — SECURITY FIX (rls_disabled_in_public)
-- Enable RLS + org-scoped policies on public tables that shipped without it.
-- ============================================================================
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

-- ============================================================================
-- 047_custom_field_definitions.sql — Custom Fields feature: table + storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox')),
  required BOOLEAN DEFAULT false,
  entity_type TEXT NOT NULL DEFAULT 'client' CHECK (entity_type IN ('client', 'project')),
  options JSONB DEFAULT '[]'::jsonb,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_org ON custom_field_definitions(organization_id, entity_type);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_custom_field_definitions" ON custom_field_definitions;
CREATE POLICY "org_custom_field_definitions" ON custom_field_definitions FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_field_values JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 048_client_report_flag_and_resources.sql — client-report toggle + project resources
-- ============================================================================
ALTER TABLE offpage_submissions ADD COLUMN IF NOT EXISTS client_report BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE blog_submissions ADD COLUMN IF NOT EXISTS client_report BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS resource_assignments JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 049_project_type.sql — single "Add Project" flow for any service type
-- ============================================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'marketing';

-- ============================================================================
-- 050_enforce_rls_everywhere.sql — re-enable RLS on every table (idempotent)
-- ============================================================================
-- 050_enforce_rls_everywhere.sql
-- Supabase's security advisor flagged a table as publicly readable/writable
-- because Row-Level Security wasn't enabled on it in production, even though
-- every table's RLS-enable statement exists somewhere in migrations 001-049.
-- Most likely cause: an earlier migration (from before the in-app "Database
-- Updates" runner existed, or applied by hand) never actually reached the
-- live database. Rather than chase down which single table it is, this
-- re-issues ENABLE ROW LEVEL SECURITY for every table in the schema —
-- enabling RLS on a table where it's already enabled is a no-op, so this is
-- safe to run any number of times and covers the gap regardless of which
-- table/migration slipped through.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations', 'users', 'user_permissions', 'audit_log',
      'clients', 'client_team_assignments', 'client_portal_access',
      'projects', 'project_team_assignments', 'tracking_tools',
      'login_credentials', 'social_media_accounts',
      'client_tasks', 'contacts', 'client_notes', 'client_integrations',
      'custom_field_definitions', 'masters', 'directory_sites',
      'offpage_submissions', 'blog_submissions',
      'keywords', 'keyword_rankings', 'onpage_details',
      'leads', 'team_invites', 'user_notification_prefs',
      'notifications', 'dashboards', 'dashboard_activity',
      'custom_reports', 'report_definitions', 'report_schedules',
      'report_share_tokens', 'marketing_reports',
      'integrations', 'qb_items', 'invoices',
      'social_accounts', 'social_media_postings', 'social_published_posts',
      'posting_slots', 'group_postings', 'media_assets',
      'messages', 'google_drive_files',
      'activity_targets', 'target_explanations',
      'upsell_analytics', 'upsell_dismissals',
      'merge_log', 'organization_settings', 'login_otps',
      'user_project_access'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 051_force_rls_everywhere.sql — FORCE RLS on every table (idempotent)
-- ============================================================================
-- 051_force_rls_everywhere.sql
-- ENABLE ROW LEVEL SECURITY (migration 050) still lets a connection using
-- the table OWNER role bypass every policy — Postgres exempts owners by
-- default. FORCE ROW LEVEL SECURITY closes that: it makes RLS apply even to
-- the owner (it never applies to superusers or roles with BYPASSRLS, which
-- is how Supabase's service_role / the app's own admin connection keeps
-- working normally). This is a pure hardening step — no policy changes, no
-- behavior change for the app or its authenticated/anon Supabase roles.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations', 'users', 'user_permissions', 'audit_log',
      'clients', 'client_team_assignments', 'client_portal_access',
      'projects', 'project_team_assignments', 'tracking_tools',
      'login_credentials', 'social_media_accounts',
      'client_tasks', 'contacts', 'client_notes', 'client_integrations',
      'custom_field_definitions', 'masters', 'directory_sites',
      'offpage_submissions', 'blog_submissions',
      'keywords', 'keyword_rankings', 'onpage_details',
      'leads', 'team_invites', 'user_notification_prefs',
      'notifications', 'dashboards', 'dashboard_activity',
      'custom_reports', 'report_definitions', 'report_schedules',
      'report_share_tokens', 'marketing_reports',
      'integrations', 'qb_items', 'invoices',
      'social_accounts', 'social_media_postings', 'social_published_posts',
      'posting_slots', 'group_postings', 'media_assets',
      'messages', 'google_drive_files',
      'activity_targets', 'target_explanations',
      'upsell_analytics', 'upsell_dismissals',
      'merge_log', 'organization_settings', 'login_otps',
      'user_project_access'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 052_fix_missing_rls_policies.sql — add missing policies for organizations,
-- user_permissions, client_team_assignments, project_team_assignments
-- (fixes a lockout bug in 050 found in post-merge review)
-- ============================================================================
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
`
