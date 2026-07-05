-- Task enhancements for the cross-client "My Tasks" view.
-- Migration 012 already defines due_date, assigned_to and priority on client_tasks;
-- the guards below are no-ops when 012 has been applied, but make this migration
-- safe to run against environments where the table predates those columns.

ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';

-- Allow org-level tasks that aren't tied to a specific client.
ALTER TABLE client_tasks ALTER COLUMN client_id DROP NOT NULL;

-- Indexes for the My Tasks view (filter by assignee, sort/group by due date).
CREATE INDEX IF NOT EXISTS idx_client_tasks_org ON client_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_tasks_assigned_to ON client_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_client_tasks_due_date ON client_tasks(due_date);
