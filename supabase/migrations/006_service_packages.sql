-- Add service_packages column to store per-service pricing and deliverables
ALTER TABLE clients ADD COLUMN IF NOT EXISTS service_packages JSONB DEFAULT '[]';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposal_url TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS proposal_status TEXT DEFAULT 'draft' CHECK (proposal_status IN ('draft','pending_approval','approved','rejected'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_place_id TEXT;
