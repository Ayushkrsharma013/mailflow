-- MailFlow: multi-account Gmail AI inbox organizer schema
-- Applied to: lead-engine project (tbsqpnqzpbnilifhwvgr)

-- 1. gmail_accounts
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  email TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  google_access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, email)
);
ALTER TABLE gmail_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_accounts_user_policy ON gmail_accounts FOR ALL USING (auth.uid() = user_id);

-- 2. digests
CREATE TABLE IF NOT EXISTS digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  account_id UUID REFERENCES gmail_accounts ON DELETE CASCADE,
  status TEXT DEFAULT 'processing',
  total_emails INT DEFAULT 0,
  categories JSONB,
  summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY digests_user_policy ON digests FOR ALL USING (auth.uid() = user_id);

-- 3. digest_emails
CREATE TABLE IF NOT EXISTS digest_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id UUID REFERENCES digests ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES gmail_accounts ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  category TEXT NOT NULL,
  ai_summary TEXT,
  ai_suggested_action TEXT,
  ai_draft_reply TEXT,
  is_read BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(digest_id, gmail_message_id)
);
ALTER TABLE digest_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY digest_emails_user_policy ON digest_emails FOR ALL USING (auth.uid() = user_id);

-- 4. mailflow_actions
CREATE TABLE IF NOT EXISTS mailflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_email_id UUID REFERENCES digest_emails ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  resolved_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE mailflow_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY mailflow_actions_user_policy ON mailflow_actions FOR ALL USING (auth.uid() = user_id);

-- 5. mailflow_settings
CREATE TABLE IF NOT EXISTS mailflow_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users UNIQUE NOT NULL,
  digest_schedule JSONB DEFAULT '["06:00","12:00","18:00"]',
  auto_archive_categories JSONB DEFAULT '["promotion","spam"]',
  tone_style TEXT DEFAULT 'professional',
  telegram_chat_id TEXT,
  slack_channel_id TEXT,
  slack_webhook_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE mailflow_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY mailflow_settings_user_policy ON mailflow_settings FOR ALL USING (auth.uid() = user_id);
