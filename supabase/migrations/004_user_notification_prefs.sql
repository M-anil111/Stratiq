-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_prefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekly_target_email BOOLEAN NOT NULL DEFAULT true,
  friday_reminder_email BOOLEAN NOT NULL DEFAULT true,
  missed_target_email BOOLEAN NOT NULL DEFAULT true,
  monthly_report_email BOOLEAN NOT NULL DEFAULT true,
  new_message_email BOOLEAN NOT NULL DEFAULT true,
  new_client_email BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prefs" ON user_notification_prefs
  FOR ALL USING (auth.uid() = user_id);
