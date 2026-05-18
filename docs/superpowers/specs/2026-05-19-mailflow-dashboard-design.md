# MailFlow — Productized Dashboard Design Spec

**Date:** 2026-05-19
**Status:** Approved

## Overview

Transform MailFlow from a functional AI inbox tool into a full productized SaaS dashboard with:
- Minimalist production-grade UI
- Floating AI chat widget (Gemini 2.5 Flash with tool calling)
- Telegram bot sync (lightweight quick-action companion)
- Guided onboarding wizard
- Public landing page with pricing tiers

## Architecture

### Chat System Flow

```
User types message → POST /api/chat → Gemini 2.5 Flash (tool calling) → response
                                          │
                                     Tool definitions:
                                     • get_inbox_summary
                                     • get_email_details
                                     • draft_reply
                                     • approve_action
                                     • reject_action
                                     • archive_email
                                     • run_digest
```

All messages persisted to Supabase (`chat_conversations` + `chat_messages`). Conversation restored on page reload.

### Component Tree

```
Layout
├── Shell (sidebar — refined, 180px)
├── Dashboard
│   ├── DigestOverview (category cards — refined)
│   ├── EmailList (scrollable — refined)
│   ├── ActionQueue (pending approvals — refined)
│   └── ChatWidget (floating, bottom-right) ← NEW
├── Accounts (Gmail connect — refined)
├── Settings (refined)
├── Onboarding (4-step wizard) ← NEW
├── Landing (hero, features, pricing) ← REWORKED
└── Login (refined)
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Send message, get AI response with tool calling |
| `/api/chat/history` | GET | Load conversation history for current user |
| `/api/chat/history` | DELETE | Clear conversation / start new chat |

### New Database Tables

| Table | Purpose |
|-------|---------|
| `chat_conversations` | id, user_id, title, created_at |
| `chat_messages` | id, conversation_id, role, content, tool_calls (jsonb), created_at |
| `onboarding_progress` | id, user_id, current_step, completed (bool), completed_at |

### No New Dependencies

All built on existing stack: Next.js 16, Tailwind 4, framer-motion, lucide-react, Gemini API, Supabase.

---

## Chat Widget

### Position & Behavior
- Floating button: bottom-right, 24px from edges, 48x48 circle
- Cyan pulse ring animation on idle
- Expands to 380w × 520h panel
- Glass-morphism: backdrop-blur, subtle border
- Overlays dashboard without resizing content
- Closes on Esc key or clicking outside

### States
- **Empty:** Greeting message + 4 suggestion chips ("Summarize my inbox", "Check for urgent emails", "Draft replies for all action items", "What can you do?")
- **Loading:** Three bouncing cyan dots (thinking indicator)
- **Error:** Inline error card with retry button
- **Active:** AI messages (left-aligned, subtle accent), user messages (right-aligned, cyan bg)
- **Tool execution:** Expandable card showing tool name + result (e.g., "get_inbox_summary — done")

### Context Awareness
- Header context pill updates based on what the user is viewing in the dashboard
- Examples: "Viewing: Today's Digest · 17 emails", "Viewing: Email from Sarah Chen"
- AI always knows the current digest context

### Key Interactions
- "Summarize my inbox" → runs digest, shows inline category breakdown
- "Draft a reply to the urgent one from Sarah" → finds email, drafts reply, shows Approve/Edit/Discard buttons
- "Approve all drafts" → bulk-approves all pending actions
- "Archive all promotions" → bulk-archives promo-category emails
- "Change my reply tone to casual" → updates user settings

### Gemini System Prompt
The AI is an expert email assistant. It has access to tool functions for inbox operations. It summarizes, drafts, approves, and archives — always showing the user what it's doing via tool call cards. Tone: helpful, concise, proactive.

### Persistence
- All messages saved to `chat_messages` table
- Conversation restored on page reload
- "New chat" button clears context and starts fresh

---

## Dashboard Redesign

### Design Principles
- More negative space, fewer borders
- One accent color (cyan #00d4ff), everything else grayscale
- Cards: subtle top-border accent instead of full colored borders
- Softer category colors (current red/green/orange are slightly loud)
- Typography: Geist, tabular figures for numbers

### Sidebar
- Width: 180px (down from 220px)
- Softer right border
- Active nav item: subtle bg shift + left cyan dot (keep layoutId animation)
- "Check Inbox" button moved into sidebar as compact action button
- Logo simplified

### Category Cards
- Top accent strip (2px gradient) replaces full border
- Softer background tint
- Numbers use tabular-nums for alignment
- Fill bar animation on load

### Email List
- Tighter row height
- Category badge: colored dot + label, no border
- Smoother expand/collapse transitions
- Empty state: cleaner illustration

### Action Queue
- Softer orange accent
- Buttons: icon-only with tooltips on desktop
- "Send Edited" flow streamlined

### Mobile
- Sidebar collapses to bottom tab bar (4 icons)
- Chat widget goes fullscreen
- Category cards stack 2-column

---

## Onboarding Wizard

### Flow (4 steps)
1. **Welcome** — value prop + email/password signup. "Get Started" → step 2
2. **Connect Gmail** — Google OAuth button. Shows connected email with green badge. Skip option
3. **Notification Channels** — Telegram Chat ID input + Slack webhook (optional). Both skippable
4. **Done** — "You're all set!" Auto-runs first digest, shows mini category preview. "Go to Dashboard" CTA

### UX
- Full-screen centered card (same glass style as login page)
- Stepper dots at top
- Fade transitions between steps
- Progress saved to `onboarding_progress` table
- Middleware redirects to `/onboarding` if incomplete
- Once completed, never shown again

---

## Landing Page & Pricing

### Landing Sections
1. **Hero** — "Your inbox, on autopilot" with animated envelope, "Powered by AI" badge, CTA
2. **How it works** — 3 steps: Connect Gmail → AI categorizes → Approve or auto-handle
3. **Pricing** — 3-tier grid
4. **Footer** — login, privacy, terms links

### Pricing Tiers

| | Starter | Pro | Business |
|---|---|---|---|
| Price | Free | $19/mo | $49/mo |
| Gmail accounts | 1 | 3 | Unlimited |
| Digests | 1/day | 3/day | Hourly |
| AI replies | Basic | Custom tone | Priority AI |
| Telegram | — | Yes | Yes |
| Slack | — | Yes | Yes |
| Support | — | Email | Priority chat |

### Design
- 3-column grid, Pro card slightly elevated with subtle glow
- Free: muted, Business: dark, Pro: highlighted
- Feature comparison table below cards
- "Get Started" links to signup (no Stripe integration in this phase)

---

## Telegram Sync

### Current (kept)
- `/start`, `/check-inbox`, inline approve/reject buttons
- Lightweight notification + quick-action channel

### New — Bidirectional Sync
- Enable Supabase Realtime on `mailflow_actions` table
- Actions approved on Telegram → web dashboard updates in real-time
- Actions approved on web → Telegram message gets edited ("✅ Approved via web")
- Chat widget and Telegram bot share the same Gemini tool definitions
- No new Telegram commands — it stays the companion, not a second chat interface

---

## Implementation Phases

| Phase | What | Effort |
|-------|------|--------|
| 1 | Chat widget + `/api/chat` with Gemini tool calling + Supabase persistence | Core |
| 2 | Dashboard polish — minimalist refinements, sidebar, card redesign | Medium |
| 3 | Onboarding wizard — 4-step flow, progress tracking | Medium |
| 4 | Landing page + pricing — marketing site, 3 tiers | Medium |
| 5 | Telegram Realtime sync — enable Realtime on actions table, bidirectional updates | Small |

---

## Spec Self-Review

- No TBDs or placeholders — all sections are concrete
- Architecture matches feature descriptions — chat widget, onboarding, pricing are all accounted for
- Scope is focused: 5 phases, no scope creep, Stripe deferred to future
- No ambiguity: specific tools, tables, components, and interaction behaviors defined
- Existing code patterns respected: inline styles pattern (not CSS modules), framer-motion for animations, Geist font, cyan accent palette
