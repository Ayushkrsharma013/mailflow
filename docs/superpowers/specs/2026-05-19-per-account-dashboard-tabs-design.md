# Per-Account Dashboard Tabs — Design Spec

**Date:** 2026-05-19  
**Scope:** Dashboard filtering by connected Gmail account  
**Approach:** Frontend-only filtering (no backend changes)

---

## Problem

The dashboard currently shows a single unified digest that merges emails from all connected Gmail accounts. The `AccountSelector` component displays account badges but they are non-interactive. There is no way to isolate stats or emails for a specific account.

---

## Goal

Add an interactive tab strip to the dashboard header. Selecting a tab filters the entire page — stats, category counts, email list, and action queue — to that account only. An "All" tab (default) restores the unified view.

---

## Architecture

### What changes

| File | Change |
|------|--------|
| `components/dashboard/AccountSelector.tsx` | Convert display badges → interactive tab strip |
| `components/dashboard/DigestOverview.tsx` | Accept `emails` array, derive category counts from it |
| `app/dashboard/page.tsx` | Add `activeAccountId` state, derive filtered data, wire everything together |

### What does NOT change

- `components/dashboard/EmailList.tsx` — already accepts `emails` prop
- `components/dashboard/ActionQueue.tsx` — already accepts `actions` prop
- All API routes — `digest/latest` already returns `account_id` on every `digest_emails` row via `select("*")`
- Database schema

---

## Component Design

### AccountSelector

**Props:**
```ts
interface Props {
  accounts: { id: string; email: string }[]
  emails: { account_id: string }[]   // full unfiltered list — for count badges
  activeId: string | null            // null = "All"
  onSelect: (id: string | null) => void
}
```

**Rendered output:**
```
[ All  12 ]  [ user@gmail.com  7 ]  [ work@company.com  5 ]
```

**Visual states:**
- Active tab: `background: rgba(0,212,255,0.12)`, `border: 1px solid rgba(0,212,255,0.35)`, white text
- Inactive tab: transparent background, `border: 1px solid rgba(255,255,255,0.08)`, muted text, brightens on hover
- Count badge: monospace, dimmer color, sits to the right of the email address
- Email truncation: `max-width: 140px`, `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`
- "All" tab always first; count = `emails.length`

### DigestOverview

**Props change:**
```ts
// Before
{ digest: Record<string, unknown> }

// After
{ digest: Record<string, unknown>; emails: { category: string }[] }
```

Category counts are derived from the `emails` array instead of `digest.categories`:
```ts
const categories = emails.reduce((acc, e) => {
  acc[e.category] = (acc[e.category] || 0) + 1
  return acc
}, {} as Record<string, number>)
```

`digest.summary` (the AI-generated text) is still displayed as-is — it remains the global summary regardless of selected tab.

### dashboard/page.tsx

**New state:**
```ts
const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
const [accounts, setAccounts] = useState<{ id: string; email: string; is_active: boolean }[]>([])
```

`accounts` replaces the inline `activeAccounts` variable — `fetchLatest` stores the full list via `setAccounts(accountsData.accounts || [])` instead of only counting them. The `AccountSelector` receives `accounts.filter(a => a.is_active)` as its `accounts` prop.

**Derived values** (computed every render, no extra fetches):
```ts
const visibleEmails = activeAccountId
  ? data.emails.filter(e => e.account_id === activeAccountId)
  : data.emails

const visibleEmailIds = new Set(visibleEmails.map(e => e.id))

const visibleActions = activeAccountId
  ? data.actions.filter(a => visibleEmailIds.has(a.digest_email_id))
  : data.actions
```

**Stats recomputed from visible arrays:**
```ts
const pending  = visibleActions.filter(a => a.status === "pending").length
const total    = visibleEmails.length
const handled  = total > 0 ? Math.round(((total - pending) / total) * 100) : 100

setStats({
  emailsToday: total,
  accounts: activeAccountId ? 1 : activeAccounts.length,
  pending,
  handled,
})
```

**AccountSelector wired in header:**
```tsx
<AccountSelector
  accounts={accounts}
  emails={data?.emails || []}
  activeId={activeAccountId}
  onSelect={setActiveAccountId}
/>
```

**Data passed downstream uses visible arrays:**
```tsx
<DigestOverview digest={data.digest} emails={visibleEmails} />
<EmailList emails={visibleEmails} />
<ActionQueue actions={visibleActions} onAction={fetchLatest} />
```

---

## Data Flow Summary

```
/api/digest/latest  →  data.{ digest, emails, actions }  (fetched once)
/api/gmail/accounts →  accounts[]                         (fetched once)

activeAccountId (state)
  │
  ├─ null ("All")  →  visibleEmails = data.emails
  │                   visibleActions = data.actions
  │
  └─ accountId     →  visibleEmails = data.emails.filter(e.account_id === id)
                      visibleActions = data.actions.filter(a in visibleEmailIds)

visibleEmails  →  DigestOverview (counts), EmailList
visibleActions →  ActionQueue, stats.pending
```

---

## Edge Cases

- **One account connected:** "All" and the single account tab show identical data. Both tabs render, since the UI is cleaner when the tab count is consistent.
- **Account in accounts list but no emails in digest:** Tab appears with count badge `0`. Clicking it shows empty state (existing "No digests yet" UI).
- **No digest yet:** `data` is null, so `visibleEmails` / `visibleActions` are empty arrays. `AccountSelector` still renders tabs from the `accounts` fetch.
- **Tab switch resets nothing:** `activeAccountId` changing re-derives filtered data in the same render — no loading state, no spinner.

---

## Out of Scope

- Per-account digest summaries (the AI summary remains global)
- Persisting selected tab across page navigation
- Reordering or hiding account tabs
