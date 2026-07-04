-- Google Drive file metadata cache
CREATE TABLE IF NOT EXISTS google_drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT,
  folder_id TEXT,
  web_view_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gdrive_files_client ON google_drive_files(client_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_files_org ON google_drive_files(organization_id);
