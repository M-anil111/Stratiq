-- 049_project_type.sql
-- Adds a project_type so a single "Add Project" flow can create any kind of
-- engagement (marketing, website, mobile app, hosting, other) instead of the
-- marketing-only form that existed before. Defaults to 'marketing' so every
-- existing row keeps its current meaning without a backfill.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'marketing';
