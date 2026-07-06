-- Add extended company profile fields to organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add preferences JSONB to user_notification_prefs to store all extra notification toggles
ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
