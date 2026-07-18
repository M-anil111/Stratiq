-- 048_client_report_flag_and_resources.sql
-- Two fields ported from the team's prior system (NetQuick):
--
-- 1. A per-submission "include in client report" toggle on off-page and
--    blog submissions, so internal/draft/test entries can be logged without
--    automatically appearing in client-facing monthly reports. Defaults to
--    true (existing behavior: everything shows) so nothing already logged
--    silently disappears from reports.
-- 2. Granular per-deliverable resource assignment on projects (SEO, PPC,
--    Content, Video, Social Media resource — each a list of user ids),
--    replacing the old system's fixed single-manager-per-project model
--    with the same multi-person-per-deliverable-type structure used there.

ALTER TABLE offpage_submissions ADD COLUMN IF NOT EXISTS client_report BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE blog_submissions ADD COLUMN IF NOT EXISTS client_report BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS resource_assignments JSONB NOT NULL DEFAULT '{}'::jsonb;
