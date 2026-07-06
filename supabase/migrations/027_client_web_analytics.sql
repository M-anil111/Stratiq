-- Per-client Google Analytics (GA4) + Search Console linkage.
-- OAuth tokens stay org-level (organization_settings); here we only store
-- which GA4 property / GSC site each client is linked to.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga_property_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ga_property_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gsc_site_url TEXT;
