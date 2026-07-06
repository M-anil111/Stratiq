-- Step-up auth: one-time login verification codes.

CREATE TABLE IF NOT EXISTS login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_otps_user_id ON login_otps(user_id);

ALTER TABLE login_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_select'
  ) THEN
    CREATE POLICY own_login_otps_select ON login_otps
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_insert'
  ) THEN
    CREATE POLICY own_login_otps_insert ON login_otps
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_otps' AND policyname = 'own_login_otps_update'
  ) THEN
    CREATE POLICY own_login_otps_update ON login_otps
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
