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
