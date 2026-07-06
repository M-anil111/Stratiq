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
