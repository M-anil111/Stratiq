-- Add access_level and status to social_media_accounts
ALTER TABLE social_media_accounts
  ADD COLUMN IF NOT EXISTS access_level TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add access_type, notes, url to tracking_tools
ALTER TABLE tracking_tools
  ADD COLUMN IF NOT EXISTS access_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT;
