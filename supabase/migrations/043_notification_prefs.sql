-- Per-user notification preferences stored as a JSONB blob on the users row.
-- Shape: { "muteAll": bool, "pauseEmail": bool, "events": { "<event>": { "inapp": bool, "email": bool } } }
-- The settings page (GET/PUT /api/settings/notifications) merges this over server-side
-- defaults, so a NULL/missing column simply means "everything on". Idempotent & additive.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
