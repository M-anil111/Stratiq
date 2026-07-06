-- Map Stratiq clients and projects to a ProofHub project.
-- Stores the numeric ProofHub project id (as TEXT to stay agnostic) so the
-- Tasks module can deep-link a Stratiq record to its ProofHub board.
-- Idempotent & additive — safe to re-run.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS proofhub_project_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proofhub_project_id TEXT;
