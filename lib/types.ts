export interface GmailAccount {
  id: string;
  user_id: string;
  email: string;
  google_refresh_token: string;
  google_access_token: string;
  token_expires_at: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  picture_url: string | null;
  created_at: string;
}

export interface Digest {
  id: string;
  user_id: string;
  account_id: string | null;
  status: 'processing' | 'completed' | 'failed';
  total_emails: number;
  categories: Record<string, number> | null;
  summary: string | null;
  error_message: string | null;
  created_at: string;
}

export interface DigestEmail {
  id: string;
  digest_id: string;
  account_id: string;
  user_id: string;
  gmail_message_id: string;
  thread_id: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  category: 'urgent' | 'action_needed' | 'fyi' | 'promotion' | 'spam';
  ai_summary: string | null;
  ai_suggested_action: 'reply' | 'archive' | 'snooze' | 'calendar' | 'none' | null;
  ai_draft_reply: string | null;
  is_read: boolean;
  is_actioned: boolean;
  created_at: string;
}

export interface MailflowAction {
  id: string;
  digest_email_id: string;
  user_id: string;
  action_type: 'send_reply' | 'archive' | 'snooze' | 'label';
  action_payload: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  approved_by: 'telegram' | 'slack' | 'web' | null;
  resolved_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface MailflowSettings {
  id: string;
  user_id: string;
  digest_schedule: string[];
  auto_archive_categories: string[];
  tone_style: 'professional' | 'casual' | 'direct';
  telegram_chat_id: string | null;
  slack_channel_id: string | null;
  slack_webhook_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
}

export interface CategorizedEmail {
  id: string;
  category: DigestEmail['category'];
  summary: string;
  suggestedAction: NonNullable<DigestEmail['ai_suggested_action']>;
  draftReply: string | null;
}

export interface DigestResult {
  digest: Digest;
  emails: DigestEmail[];
  actions: MailflowAction[];
}

export interface DigestNotificationPayload {
  accountsCount: number;
  totalEmails: number;
  urgentCount: number;
  actionCount: number;
  fyiCount: number;
  promoCount: number;
  spamCount: number;
  summary: string;
  pendingActions: {
    id: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    actionType: string;
    draftReply: string;
  }[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: ChatToolCall[] | null;
  created_at: string;
}

export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'done' | 'error';
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}
