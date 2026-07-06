-- ============================================================
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
