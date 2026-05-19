# MailFlow — Real-Time Monitoring & Reliability Design

**Date**: 2026-05-19  
**Status**: Approved  

---

## Problem Statement

Four compounding issues prevent MailFlow from being a reliable 24/7 inbox monitor:

1. **Rate limiting** — `categorizeEmails` sends all 50 emails in one Gemini call. `draftReplyWithTone` fires one call per action email immediately after. 5 action emails = 6 back-to-back calls → Gemini free tier (10 RPM) blocks for 287 seconds.
2. **No historical backfill** — First connect only fetches current unread emails. Months of existing inbox history is never processed.
3. **Polling-only monitoring** — 3× daily cron means up to 8-hour gaps between syncs. A client emergency email at 7:01 AM isn't seen until noon.
4. **Hardcoded UTC digest times** — Schedule ignores user timezone. A user in IST gets their "morning" digest at 12:30 PM local time.

---

## Solution Overview

| Problem | Solution |
|---|---|
| Rate limiting | Batch categorization — chunks of 10 emails, 1.1s gap, draft-reply batched into one call |
| Historical backfill | On first connect: paginated 90-day fetch, cap 500 emails, stores `gmail_history_id` |
| Real-time monitoring | Gmail Push Notifications via GCP Pub/Sub → `/api/gmail/push` webhook |
| Timezone-aware digest | Hourly cron + per-user timezone/schedule check |

---

## Architecture

### Before
```
Cron 3× daily (fixed UTC)
  → fetchUnreadMessages(account, 50) — "unread in last 30d"
  → categorizeEmails(all 50) — single Gemini call → rate limit
  → draftReplyWithTone() × N — one call per action email → more rate limits
  → sendDigestTelegram / sendDigestSlack
```

### After
```
── Real-time path ──────────────────────────────────────────────
Gmail new email
  → Google Pub/Sub → POST /api/gmail/push
    → decode notification (email address + historyId)
    → history.list(startHistoryId) → fetch only new messages
    → categorizeEmailsBatched(newMessages) — chunks of 10
    → if urgent/action_needed → immediate Telegram/Slack alert
    → save to digest_emails, update gmail_history_id

── Scheduled path ──────────────────────────────────────────────
Cron every hour (7 * * * *)
  → for each user: convert UTC → user timezone
  → if current local hour ∈ digest_schedule → runDigestForUser()
    → fetchNewMessagesSinceHistory(account) — history API diff
    → categorizeEmailsBatched() — chunks of 10, 1.1s gap
    → generateDigestSummary()
    → sendDigestTelegram / sendDigestSlack

── First connect ───────────────────────────────────────────────
OAuth callback completes
  → registerGmailWatch(account) → Google registers push webhook
  → background: backfillAccount(account)
    → messages.list newer_than:90d, paginated, cap 500
    → categorizeEmailsBatched() in batches of 10
    → store current gmail_history_id on completion
```

---

## Schema Changes

### `gmail_accounts` table — new columns

```sql
ALTER TABLE gmail_accounts
  ADD COLUMN gmail_history_id TEXT,
  ADD COLUMN watch_expiry TIMESTAMPTZ,
  ADD COLUMN watch_resource_id TEXT;
```

No other table changes needed. `digest_emails` and `mailflow_actions` are unchanged.

---

## File Changes

### Modified files

| File | Change |
|---|---|
| `lib/categorize.ts` | Add `categorizeEmailsBatched()` — chunks of 10 with delay; replace `draftReplyWithTone` sequential calls with batched multi-email draft prompt |
| `lib/gmail.ts` | Add `fetchNewMessagesSinceHistory()`, `registerGmailWatch()`, `stopGmailWatch()`, `backfillAccount()` |
| `lib/digest.ts` | Switch from `fetchUnreadMessages` to `fetchNewMessagesSinceHistory`; use `categorizeEmailsBatched` |
| `app/api/auth/google/callback/route.ts` | Call `registerGmailWatch()` and trigger `backfillAccount()` after saving account |
| `app/api/cron/digest/route.ts` | Add timezone-aware filtering — only run digest for users whose local hour matches schedule |
| `vercel.json` | Replace 3 fixed crons with one hourly cron + add watch-renewal cron |
| `middleware.ts` | Add `/api/gmail/push` to bypass list |

### New files

| File | Purpose |
|---|---|
| `app/api/gmail/push/route.ts` | Gmail Push Notifications webhook handler |
| `app/api/cron/watch-renew/route.ts` | Daily cron: renew Gmail watches expiring within 24h |

---

## Detailed Behaviour

### Batch Categorization (`lib/categorize.ts`)

```
categorizeEmailsBatched(messages: GmailMessage[]):
  chunks = split messages into groups of 10
  results = new Map()
  for each chunk:
    chunkResult = categorizeEmails(chunk)   // existing single-call fn
    merge chunkResult into results
    if not last chunk: sleep(1100ms)
  return results

draftRepliesForActions(emails, sentExamples):
  // Single Gemini call listing all action emails
  // Returns Map<emailId, draftReply>
  // Replaces the per-email loop in digest.ts
```

### History API Sync (`lib/gmail.ts`)

```
fetchNewMessagesSinceHistory(account):
  if account.gmail_history_id is null:
    return fetchUnreadMessages(account, 50)   // fallback for unmigrated accounts
  
  GET /gmail/v1/users/me/history
    ?startHistoryId={account.gmail_history_id}
    &historyTypes=messageAdded
    &labelId=INBOX
  
  collect all message IDs from history.messagesAdded
  fetch full detail for each message (parallel, max 10 at a time)
  
  // Caller is responsible for updating gmail_history_id after processing.
  // Return both messages and the latest historyId from the response.
  return { messages: GmailMessage[], newHistoryId: string }
```

**`gmail_history_id` update ownership**: The *caller* (push webhook handler or digest runner) updates `gmail_history_id` after successfully saving emails to the DB. This prevents losing the pointer if categorization fails partway through.

### Gmail Watch Registration (`lib/gmail.ts`)

```
registerGmailWatch(account):
  POST /gmail/v1/users/me/watch
    { topicName: process.env.GOOGLE_PUBSUB_TOPIC, labelIds: ["INBOX"] }
  
  store response.expiration as watch_expiry (milliseconds → ISO string)
  store response.resourceId as watch_resource_id
  // Always overwrite gmail_history_id with the fresh value from watch()
  // so the push webhook starts from a known-good point.
  store response.historyId as gmail_history_id
  update gmail_accounts row
```

**Backfill `historyId`**: After backfill completes, call `GET /gmail/v1/users/me/profile` to get the current `historyId` and store it. Do not infer it from the last fetched message (messages don't carry a reliable `historyId`).

### Push Webhook (`app/api/gmail/push/route.ts`)

```
POST /api/gmail/push:
  verify Authorization header = "Bearer {GOOGLE_PUBSUB_TOKEN}"
  decode base64 message.data → { emailAddress, historyId }
  
  find gmail_accounts row by email = emailAddress
  if not found: return 200 (acknowledge, don't retry)
  
  newMessages = fetchNewMessagesSinceHistory(account)
  if no new messages: return 200
  
  categorized = categorizeEmailsBatched(newMessages)
  save to digest_emails (reuse existing insert logic)
  
  for urgent/action_needed emails:
    send immediate single-email alert to Telegram/Slack
    (NOT a full digest — just the one email with approve/reject buttons)
  
  return 200
```

### Timezone-Aware Cron (`app/api/cron/digest/route.ts`)

```
GET /api/cron/digest:
  for each user with active Gmail accounts:
    settings = fetch mailflow_settings for user
    tz = settings.timezone || "UTC"
    schedule = settings.digest_schedule || ["morning", "afternoon", "evening"]
    
    localHour = getCurrentHourInTimezone(tz)
    scheduleHours = { morning: 7, afternoon: 12, evening: 18 }
    
    if localHour ∈ scheduleHours[schedule]:
      runDigestForUser(userId) → full digest + notify
```

### Watch Renewal Cron (`app/api/cron/watch-renew/route.ts`)

```
GET /api/cron/watch-renew:
  find all gmail_accounts where watch_expiry < NOW() + 24h
  for each: registerGmailWatch(account)   // re-registers, updates expiry
```

---

## New Environment Variables

| Variable | Purpose |
|---|---|
| `GOOGLE_PUBSUB_TOPIC` | Full Pub/Sub topic name: `projects/{project-id}/topics/mailflow-push` |
| `GOOGLE_PUBSUB_TOKEN` | Shared secret you set in the Pub/Sub subscription's "authentication token" field. Pub/Sub sends this as `Authorization: Bearer {token}` on every push. We verify it matches to reject spoofed requests. Choose any strong random string (e.g. `openssl rand -hex 32`). |

---

## GCP Setup (one-time, ~5 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Pub/Sub → Create topic: `mailflow-push`
2. Grant Gmail publish permission: `gcloud pubsub topics add-iam-policy-binding mailflow-push --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" --role="roles/pubsub.publisher"`
3. Create push subscription → endpoint: `https://mailflow-swart.vercel.app/mailflow/api/gmail/push`
4. Add `GOOGLE_PUBSUB_TOPIC` and `GOOGLE_PUBSUB_TOKEN` to Vercel env vars

---

## `vercel.json` — Updated Crons

```json
{
  "crons": [
    { "path": "/mailflow/api/cron/digest",      "schedule": "7 * * * *" },
    { "path": "/mailflow/api/cron/watch-renew", "schedule": "0 3 * * *" }
  ]
}
```

- Digest cron: every hour at :07 — handler filters per user timezone/schedule
- Watch-renew cron: daily at 3 AM UTC — renews any watches expiring within 24h

---

## Error Handling

- **Push webhook errors**: always return HTTP 200 to prevent Pub/Sub retry storms. Log errors internally.
- **History API `historyId` invalid** (too old, account re-auth): fall back to `fetchUnreadMessages(account, 50)`, reset `gmail_history_id` to current.
- **Backfill failure**: log and set `gmail_history_id` to current historyId anyway — partial backfill is better than blocking ongoing sync.
- **Watch registration failure**: log warning, account still works via cron polling as fallback.
- **Rate limit in batched categorize**: if Gemini returns 429, retry the chunk once after 30s before failing.

---

## Out of Scope

- Multi-label watch (only INBOX label is watched)
- Slack real-time alerts (Slack webhook doesn't support approve/reject buttons natively — Telegram only for instant alerts)
- Per-email push notifications for FYI/promotion/spam categories (too noisy)
