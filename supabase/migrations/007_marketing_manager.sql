ALTER TABLE clients ADD COLUMN IF NOT EXISTS marketing_manager_id UUID REFERENCES users(id);
