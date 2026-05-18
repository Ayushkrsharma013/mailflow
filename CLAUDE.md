# CLAUDE.md — MailFlow

AI-powered Gmail inbox organizer. Connects multiple Gmail accounts, uses Gemini 2.5 Flash to categorize every email and draft replies in the user's voice, then sends a daily digest to Telegram or Slack. Users approve, edit, or reject AI-drafted replies from chat or web.

---

## Domain & URL

| What | URL |
|------|-----|
| Production | `app.flow-forges.com/mailflow` |
| Vercel project | `mailflow-swart.vercel.app` |
| Local dev | `http://localhost:3002/mailflow` |

MailFlow is served under `/mailflow` basePath via multi-zone rewrite on the `app.flow-forges.com` hub project. The Next.js app sets `basePath: '/mailflow'` in `next.config.mjs`.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (Turbopack, App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + inline styles (no CSS modules) |
| Animations | framer-motion |
| Icons | lucide-react |
| Auth | Supabase Auth + SSR cookies (`@supabase/ssr`) |
| Database | Supabase Postgres — project `otxifqcvgmxoxemmgbjd` (shared `mark1-flowforges`) |
| AI | Gemini 2.5 Flash (categorization, draft replies, chat assistant) |
| Email | Gmail OAuth (Google APIs) |
| Notifications | Telegram Bot API, Slack Webhooks |
| Cron | Vercel Cron Jobs (morning/afternoon/evening digest) |
| Package manager | npm |

---

## Repository Structure

```
D:\Flow-Forges\mailflow\
├── app/
│   ├── layout.tsx              # Root layout (dark theme, Geist font)
│   ├── globals.css             # CSS variables, base styles
│   ├── page.tsx                # Landing page (server component, checks auth)
│   ├── login/page.tsx          # Login page (Supabase email/password)
│   ├── dashboard/page.tsx      # Main dashboard (digest view + ChatWidget)
│   ├── accounts/page.tsx       # Connected Gmail accounts
│   ├── settings/page.tsx       # User settings (tone, channels, auto-archive)
│   ├── onboarding/page.tsx     # 4-step setup wizard (new users)
│   └── api/
│       ├── chat/route.ts       # POST — Gemini chat with tool calling loop
│       ├── chat/history/route.ts  # GET/DELETE — conversation persistence
│       ├── actions/[id]/route.ts  # PATCH — approve/reject drafted replies
│       ├── auth/google/route.ts   # Gmail OAuth initiation
│       ├── auth/google/callback/route.ts  # Gmail OAuth callback
│       ├── cron/digest/route.ts   # Vercel cron trigger for digest
│       ├── digest/latest/route.ts  # GET latest digest
│       ├── digest/run/route.ts     # POST run digest now
│       ├── digest/[id]/route.ts    # GET specific digest
│       ├── gmail/accounts/route.ts # GET/DELETE Gmail accounts
│       ├── settings/route.ts       # GET/PATCH mailflow settings
│       ├── slack/route.ts          # Slack webhook handler
│       └── telegram/route.ts       # Telegram bot webhook
├── components/
│   ├── Shell.tsx                # App shell: sidebar nav (180px) + main content
│   ├── chat/
│   │   └── ChatWidget.tsx       # Floating AI chat assistant (380×520 panel)
│   ├── dashboard/
│   │   ├── AccountSelector.tsx  # Connected account badges in header
│   │   ├── ActionQueue.tsx      # Pending action cards (approve/edit/reject)
│   │   ├── DigestOverview.tsx   # Category cards (urgent/action/fyi/promo/spam)
│   │   └── EmailList.tsx        # Expandable email rows with AI summaries
│   ├── accounts/
│   │   └── ConnectAccount.tsx   # Gmail OAuth connect/disconnect UI
│   └── landing/
│       ├── LandingPage.tsx      # Hero, how-it-works, features, pricing, CTA, footer
│       ├── Envelope3D.tsx       # 3D animated envelope for hero
│       └── GalaxyBg.tsx         # Animated starfield background
├── lib/
│   ├── types.ts                 # All TypeScript interfaces (GmailAccount, Digest, etc.)
│   ├── gemini.ts                # Shared Gemini utilities (extractText, extractFunctionCall, API URL)
│   ├── chat.ts                  # Gemini tool definitions (7 tools), executeToolCall, sendMessageToGemini
│   ├── categorize.ts            # Email categorization + draft reply + digest summary (Gemini)
│   ├── digest.ts                # Core digest pipeline (fetch → categorize → draft → notify)
│   ├── actions.ts               # Execute approved actions (send reply, archive, snooze)
│   ├── gmail.ts                 # Gmail API client (fetch unread, fetch sent, send reply, archive)
│   ├── google-auth.ts           # Google OAuth2 helpers
│   ├── notify.ts                # Telegram + Slack notification dispatch
│   ├── crypto.ts                # Token encryption at rest
│   └── supabase/
│       ├── client.ts            # Browser Supabase client (singleton)
│       └── server.ts            # Server Supabase client (SSR cookies)
├── middleware.ts                # Auth guard + onboarding redirect
├── vercel.json                  # Vercel cron schedule (3x daily digest)
├── next.config.mjs              # basePath: '/mailflow', assetPrefix: '/mailflow'
├── package.json                 # Scripts, dependencies
└── .env.local                   # API keys, secrets (never committed)
```

---

## Database

All tables in Supabase project `otxifqcvgmxoxemmgbjd` (shared with mark1):

### MailFlow-specific tables

| Table | Purpose |
|-------|---------|
| `gmail_accounts` | Connected Gmail accounts (OAuth tokens, sync status) |
| `digests` | Digest runs (status, categories, AI summary) |
| `digest_emails` | Individual emails in a digest (category, AI summary, draft reply) |
| `mailflow_actions` | Pending/approved/rejected/executed actions on emails |
| `mailflow_settings` | Per-user settings (tone, channels, auto-archive, timezone) |
| `chat_conversations` | AI chat conversation sessions |
| `chat_messages` | Individual chat messages (role, content, tool_calls JSONB) |
| `onboarding_progress` | Onboarding wizard completion tracking |

### RLS
All tables have Row Level Security enabled. Policies restrict access to `auth.uid() = user_id`.

### Realtime
Enabled on `mailflow_actions` — actions approved via Telegram instantly reflect on the web dashboard.

---

## Key Flows

### Digest Pipeline
```
Vercel cron (or manual "Check Inbox" or Telegram /check-inbox)
  → runDigestForUser(userId)
    → fetchUnreadMessages(account, 50) for each active Gmail account
    → categorizeEmails(messages) via Gemini 2.5 Flash
      → Each email gets: category (urgent|action_needed|fyi|promotion|spam), summary, suggestedAction, draftReply
    → draftReplyWithTone(email, sentExamples) for action_needed emails
    → Save to digest_emails + mailflow_actions tables
    → Auto-archive promotion + spam
    → sendDigestTelegram(chatId, payload) and/or sendDigestSlack(webhook, payload)
```

### Chat Widget
```
User types message → ChatWidget.tsx → POST /api/chat
  → sendMessageToGemini(messageHistory) with 7 tool declarations
  → if Gemini returns functionCall: executeToolCall(name, args, ctx)
  → if Gemini returns text: display to user
  → Loop max 5 iterations (tool → result → Gemini → tool or text)
  → All messages persisted to chat_messages
```

### Gemini Tools (7)
| Tool | What it does |
|------|-------------|
| `get_inbox_summary` | Returns latest digest overview + category counts |
| `get_email_details` | Fetches emails by ID, search, or category filter |
| `draft_reply` | Generates AI draft reply for a specific email |
| `approve_action` | Approves + executes a pending action (sends reply) |
| `reject_action` | Rejects/discards a pending action |
| `archive_email` | Archives emails by ID or by category |
| `run_digest` | Triggers a fresh inbox scan + digest |

### Telegram Bot
- Webhook at `/api/telegram` (bypasses middleware auth)
- `/start` — links account, `/check-inbox` — runs digest
- Inline keyboard: Approve ✅ / Reject ❌ for each pending action
- On web approval: sends confirmation notification to Telegram
- Lightweight companion channel — not a second chat interface

### Onboarding
```
First login → middleware checks onboarding_progress
  → If not completed → redirect to /onboarding
  → Step 1: Sign up (email/password via Supabase auth.signUp)
  → Step 2: Connect Gmail (OAuth)
  → Step 3: Configure Telegram/Slack (optional, skippable)
  → Step 4: First digest auto-runs, shows preview, CTA to dashboard
  → Progress persisted to onboarding_progress table
```

---

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#000000` | Page background |
| `--surface` | `#080d18` | Card backgrounds |
| `--border` | `rgba(0,212,255,0.1)` | Subtle borders |
| `--text` | `#dde8f0` | Primary text |
| `--muted` | `#5a7080` | Secondary text |
| `--accent` | `#00d4ff` | Cyan accent — buttons, active states, icons |
| `--accent-soft` | `rgba(0,212,255,0.08)` | Subtle accent backgrounds |

### Typography
- Font: Geist (Google Fonts), monospace for badges/labels
- Inline styles pattern throughout (no CSS modules)
- framer-motion for page transitions, card animations, hover states

### Component Patterns
- All client components use `"use client"` directive
- Inline `style` objects (no className except for Tailwind utilities in globals.css)
- framer-motion `motion.div` for animated entrances
- `AnimatePresence` for mount/unmount transitions
- Supabase client: `createClient()` from `@/lib/supabase/client` (browser, singleton)
- Supabase server: `createSupabaseServerClient()` from `@/lib/supabase/server` (async, SSR cookies)

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY         # Supabase service role (server-only)
GEMINI_API_KEY                    # Gemini 2.5 Flash API key
GOOGLE_CLIENT_ID                  # Google OAuth client ID
GOOGLE_CLIENT_SECRET              # Google OAuth client secret
TELEGRAM_BOT_TOKEN                # Telegram bot token
SLACK_BOT_TOKEN                   # Slack bot token
SLACK_SIGNING_SECRET              # Slack signing secret
CRON_SECRET                       # Vercel cron auth secret
NEXT_PUBLIC_SITE_URL              # Site URL for redirects
```

---

## Development

```bash
cd D:\Flow-Forges\mailflow

npm install          # Install dependencies
npm run dev          # Start dev server on port 3002
npm run build        # Production build
npm start            # Start production server
npx tsc --noEmit     # TypeScript check
```

The app serves at `http://localhost:3002/mailflow` in development.

### Vercel CLI

```bash
vercel               # Preview deploy
vercel --prod        # Production deploy
vercel logs <url>    # View deployment logs
vercel env pull      # Sync env vars from Vercel
```

---

## Notes

- `basePath: '/mailflow'` — all routes and API calls MUST include the prefix in production. In development, Next.js handles this automatically for `<Link>` and `useRouter()`, but raw `fetch()` calls need `/mailflow/api/...`.
- The middleware bypasses API routes, static files, and public routes (`/`, `/login`) — everything else requires auth.
- Onboarding redirect runs after auth check — users who haven't completed onboarding are redirected to `/onboarding`.
- `mailflow_actions` has Supabase Realtime enabled — UI can subscribe to changes.
- Gemini responses use `thinkingConfig: { thinkingBudget: 0 }` for categorization to disable thinking mode and get faster responses.
- The chat widget uses `crypto.randomUUID()` for client-side message IDs — not for database IDs (those are server-generated UUIDs).
- Telegram and Slack webhooks bypass middleware auth (they use their own verification).
- The shared database (`mark1-flowforges`) contains tables for both `mark1` and `lead-engine` — be careful with schema changes.
