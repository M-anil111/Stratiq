-- Proposal approval flow: one-click approve/reject links sent via email
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approval_token TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
