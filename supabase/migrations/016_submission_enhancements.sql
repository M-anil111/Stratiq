-- Blog submissions: add new columns for redesigned UI
ALTER TABLE blog_submissions
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS word_count INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS author TEXT;

-- Make old SEO-specific columns optional (nullable)
ALTER TABLE blog_submissions
  ALTER COLUMN live_url DROP NOT NULL,
  ALTER COLUMN meta_title DROP NOT NULL,
  ALTER COLUMN meta_description DROP NOT NULL,
  ALTER COLUMN h1 DROP NOT NULL;

-- Add check constraint for blog status
ALTER TABLE blog_submissions
  ADD CONSTRAINT blog_submissions_status_check CHECK (status IN ('draft', 'published', 'scheduled'));

-- Offpage submissions: add directory_site_id for directory dropdown
ALTER TABLE offpage_submissions
  ADD COLUMN IF NOT EXISTS directory_site_id UUID REFERENCES directory_sites(id),
  ADD COLUMN IF NOT EXISTS directory_name TEXT;

-- Extend status values for offpage
ALTER TABLE offpage_submissions DROP CONSTRAINT IF EXISTS offpage_submissions_status_check;
ALTER TABLE offpage_submissions ADD CONSTRAINT offpage_submissions_status_check
  CHECK (status IN ('live', 'under_review', 'deleted', 'pending', 'rejected'));
