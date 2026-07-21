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
