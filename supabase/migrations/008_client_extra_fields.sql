-- Run this in Supabase SQL Editor
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS marketing_manager_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS client_degree VARCHAR DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS client_pin VARCHAR(10),
  ADD COLUMN IF NOT EXISTS maint_since INTEGER,
  ADD COLUMN IF NOT EXISTS maint_degree VARCHAR DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS credit_status VARCHAR DEFAULT 'good';
