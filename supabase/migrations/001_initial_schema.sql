-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations (multi-tenant root)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0EA5E9',
  plan TEXT DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'team_member' CHECK (role IN ('super_admin','admin','manager','team_member','billing_admin','client')),
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User permissions
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  module TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('view','create','edit','delete')),
  scope TEXT NOT NULL CHECK (scope IN ('all','team','own','none')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  company_name TEXT NOT NULL,
  website TEXT NOT NULL,
  about_company TEXT,
  industry TEXT,
  email TEXT,
  phone TEXT,
  street_address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  logo_urls JSONB DEFAULT '[]',
  hashtags JSONB DEFAULT '[]',
  categories JSONB DEFAULT '[]',
  num_employees INTEGER,
  flowcode_qr_urls JSONB DEFAULT '[]',
  google_maps_place_id TEXT,
  project_status TEXT DEFAULT 'active' CHECK (project_status IN ('active','on_hold','cancelled','completed','prospect','in_onboarding')),
  services JSONB DEFAULT '[]',
  advertising_types JSONB DEFAULT '[]',
  goals JSONB DEFAULT '[]',
  stakeholder_expectations JSONB DEFAULT '[]',
  target_audience TEXT,
  website_last_updated DATE,
  ndisk_link TEXT,
  google_drive_folder_url TEXT,
  google_drive_folder_id TEXT,
  sales_manager_id UUID REFERENCES users(id),
  dm_manager_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Client team assignments
CREATE TABLE client_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, user_id, role)
);

-- Client portal access
CREATE TABLE client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','on_hold','cancelled','completed','prospect','in_onboarding')),
  industry TEXT,
  services JSONB DEFAULT '[]',
  advertising_types JSONB DEFAULT '[]',
  goals JSONB DEFAULT '[]',
  sales_manager_id UUID REFERENCES users(id),
  dm_manager_id UUID REFERENCES users(id),
  google_drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Project team assignments
CREATE TABLE project_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id, role)
);

-- Tracking tools
CREATE TABLE tracking_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  profile_id TEXT,
  account_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Login credentials (AES-256-GCM encrypted passwords)
CREATE TABLE login_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Social media accounts
CREATE TABLE social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  profile_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Social media postings (activity section)
CREATE TABLE social_media_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  platform TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image','video','carousel','gif')),
  status TEXT NOT NULL CHECK (status IN ('live','under_review','deleted')),
  live_link TEXT,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  username TEXT,
  password_encrypted TEXT,
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Off-page submissions
CREATE TABLE offpage_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  submission_date DATE NOT NULL,
  website_url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('classified_submission','business_listing','social_bookmarking','profile_creation','blog_promotion','directory_submission')),
  status TEXT NOT NULL CHECK (status IN ('live','under_review','deleted')),
  live_url TEXT,
  email TEXT,
  username TEXT,
  password_encrypted TEXT,
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Blog submissions
CREATE TABLE blog_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  live_url TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  h1 TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- OnPage details
CREATE TABLE onpage_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  url TEXT NOT NULL,
  h1 TEXT NOT NULL,
  meta_title TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  primary_keywords JSONB DEFAULT '[]',
  secondary_keywords JSONB DEFAULT '[]',
  rankings TEXT,
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Group postings
CREATE TABLE group_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook_group','linkedin_group','reddit','nextdoor','discord','telegram','whatsapp','other')),
  group_name TEXT NOT NULL,
  group_url TEXT,
  post_type TEXT NOT NULL CHECK (post_type IN ('text','image','video','link_share','event_promo','poll')),
  post_content TEXT NOT NULL,
  live_link TEXT,
  status TEXT NOT NULL CHECK (status IN ('live','under_review','deleted','pending_approval')),
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  username TEXT,
  password_encrypted TEXT,
  member_count INTEGER,
  comment TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activity targets
CREATE TABLE activity_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  social_media_target INTEGER DEFAULT 0,
  offpage_target INTEGER DEFAULT 0,
  blog_target INTEGER DEFAULT 0,
  onpage_target INTEGER DEFAULT 0,
  group_posting_target INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, year, month)
);

-- Target explanations
CREATE TABLE target_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 5),
  activity_type TEXT NOT NULL,
  target_count INTEGER NOT NULL,
  completed_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','flagged')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketing reports
CREATE TABLE marketing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  google_ads_data JSONB DEFAULT '{}',
  meta_ads_data JSONB DEFAULT '{}',
  notes TEXT,
  is_sent_to_client BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, year, month)
);

-- Custom reports
CREATE TABLE custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private','team','all')),
  schedule_cron TEXT,
  schedule_recipients JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_read_by_client BOOLEAN DEFAULT false,
  is_read_by_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Directory sites (for Off-Page URL dropdown, admin-editable)
CREATE TABLE directory_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Upsell dismissals
CREATE TABLE upsell_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  card_type TEXT NOT NULL,
  dismissed_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Upsell analytics
CREATE TABLE upsell_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  card_type TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('viewed','clicked','dismissed')),
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Integrations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('google_ads','meta_ads','google_drive','google_analytics','google_search_console','quickbooks')),
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active','inactive','error')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  connected_by UUID REFERENCES users(id),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, type)
);

-- Indexes for common queries
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_clients_status ON clients(project_status);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_social_postings_project ON social_media_postings(project_id);
CREATE INDEX idx_offpage_project ON offpage_submissions(project_id);
CREATE INDEX idx_blog_project ON blog_submissions(project_id);
CREATE INDEX idx_onpage_project ON onpage_details(project_id);
CREATE INDEX idx_group_project ON group_postings(project_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_messages_client ON messages(client_id);
