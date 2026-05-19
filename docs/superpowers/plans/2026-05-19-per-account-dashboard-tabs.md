# Per-Account Dashboard Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive account tab strip to the dashboard that filters stats, category counts, email list, and action queue by selected Gmail account.

**Architecture:** Pure frontend filtering — fetch all digest data once, derive filtered arrays in `dashboard/page.tsx` from `activeAccountId` state, pass them downstream. `AccountSelector` becomes a controlled tab strip. `DigestOverview` derives category counts from the `emails` array instead of the stored aggregate in `digest.categories`. No backend changes.

**Tech Stack:** React (useState, derived render-time values), TypeScript, framer-motion, lucide-react, inline styles (project pattern)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/dashboard/AccountSelector.tsx` | Rewrite | Render tab strip; emit `onSelect` on click |
| `components/dashboard/DigestOverview.tsx` | Edit | Accept `emails` prop; derive counts from it |
| `app/dashboard/page.tsx` | Edit | Hold `activeAccountId` + `accounts` state; derive `visibleEmails`/`visibleActions`; wire everything |

---

### Task 1: Rewrite AccountSelector as an interactive tab strip

**Files:**
- Modify: `components/dashboard/AccountSelector.tsx`

Current file is 43 lines — display-only badges with no props. Full replacement.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client"

import { Mail } from "lucide-react"

interface Props {
  accounts: { id: string; email: string }[]
  emails: { account_id: string }[]
  activeId: string | null
  onSelect: (id: string | null) => void
}

export default function AccountSelector({ accounts, emails, activeId, onSelect }: Props) {
  if (accounts.length === 0) return null

  const countFor = (id: string) => emails.filter(e => e.account_id === id).length

  const tabs = [
    { id: null as string | null, label: "All", count: emails.length },
    ...accounts.map(a => ({ id: a.id as string | null, label: a.email, count: countFor(a.id) })),
  ]

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {tabs.map(tab => {
        const active = activeId === tab.id
        return (
          <button
            key={tab.id ?? "__all__"}
            onClick={() => onSelect(tab.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 7,
              border: active ? "1px solid rgba(0,212,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
              background: active ? "rgba(0,212,255,0.12)" : "transparent",
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
            }}
          >
            {tab.id !== null && (
              <Mail size={11} style={{ color: active ? "#00d4ff" : "rgba(221,232,240,0.25)", flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 11, fontFamily: "monospace",
              color: active ? "#edf6ff" : "rgba(221,232,240,0.4)",
              maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              letterSpacing: "-0.01em",
            }}>
              {tab.label}
            </span>
            <span style={{
              fontSize: 10, fontFamily: "monospace",
              color: active ? "rgba(0,212,255,0.7)" : "rgba(221,232,240,0.2)",
              minWidth: "1ch",
            }}>
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors about `AccountSelector` missing required props at its call site in `dashboard/page.tsx` — that's correct and will be fixed in Task 3. No errors inside `AccountSelector.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/AccountSelector.tsx
git commit -m "feat: convert AccountSelector to interactive tab strip"
```

---

### Task 2: Update DigestOverview to derive counts from the emails array

**Files:**
- Modify: `components/dashboard/DigestOverview.tsx`

Currently reads `digest.categories` (a pre-aggregated DB value). After this change, counts are computed from the `emails` array so filtering applies automatically.

- [ ] **Step 1: Update the export line and categories derivation**

Find these 2 lines (currently lines 13–14):
```tsx
export default function DigestOverview({ digest }: { digest: Record<string, unknown> }) {
  const categories = (digest.categories as Record<string, number>) || {}
```

Replace with:
```tsx
export default function DigestOverview({ digest, emails }: {
  digest: Record<string, unknown>
  emails: { category: string }[]
}) {
  const categories = emails.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
```

Everything else in the file (the `total` calculation, the five category cards, the summary block) is unchanged — they all read from `categories` which now comes from the emails array.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: one error — `DigestOverview` call site in `dashboard/page.tsx` is missing the `emails` prop. That will be fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/DigestOverview.tsx
git commit -m "feat: DigestOverview derives category counts from emails array"
```

---

### Task 3: Wire activeAccountId state and filtered data in dashboard/page.tsx

**Files:**
- Modify: `app/dashboard/page.tsx`

Four targeted edits inside the existing component — no structural changes to the JSX layout.

- [ ] **Step 1: Add `accounts` and `activeAccountId` state**

Find the existing state block (lines 54–59):
```tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ digest: Record<string, any>; emails: any[]; actions: any[] } | null>(null)
  const [stats, setStats] = useState<{ emailsToday: number; accounts: number; pending: number; handled: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
```

Replace with:
```tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ digest: Record<string, any>; emails: any[]; actions: any[] } | null>(null)
  const [stats, setStats] = useState<{ emailsToday: number; accounts: number; pending: number; handled: number } | null>(null)
  const [accounts, setAccounts] = useState<{ id: string; email: string; is_active: boolean }[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)
```

- [ ] **Step 2: Update fetchLatest to store the full accounts array**

Find the stats derivation block inside `fetchLatest` (lines 70–77):
```tsx
      // Derive stats
      const accountsRes = await fetch("/mailflow/api/gmail/accounts")
      const accountsData = await accountsRes.json()
      const activeAccounts = (accountsData.accounts || []).filter((a: { is_active: boolean }) => a.is_active).length
      const pending = (json.actions || []).filter((a: { status: string }) => a.status === "pending").length
      const total = (json.emails || []).length
      const handled = total > 0 ? Math.round(((total - pending) / total) * 100) : 100

      setStats({ emailsToday: total, accounts: activeAccounts, pending, handled })
```

Replace with:
```tsx
      // Derive stats
      const accountsRes = await fetch("/mailflow/api/gmail/accounts")
      const accountsData = await accountsRes.json()
      const allAccounts: { id: string; email: string; is_active: boolean }[] = accountsData.accounts || []
      setAccounts(allAccounts)
      const activeCount = allAccounts.filter(a => a.is_active).length
      const pending = (json.actions || []).filter((a: { status: string }) => a.status === "pending").length
      const total = (json.emails || []).length
      const handled = total > 0 ? Math.round(((total - pending) / total) * 100) : 100

      setStats({ emailsToday: total, accounts: activeCount, pending, handled })
```

- [ ] **Step 3: Add derived visible arrays and updated STAT_CARDS**

Find the `STAT_CARDS` definition (lines 99–104):
```tsx
  const STAT_CARDS = [
    { label: "Emails Today", value: stats?.emailsToday ?? "—", icon: Inbox, color: "#06b6d4" },
    { label: "Accounts", value: stats?.accounts ?? "—", icon: Mail, color: "#00d4ff" },
    { label: "Pending", value: stats?.pending ?? "—", icon: Clock, color: "#f97316" },
    { label: "Auto-handled", value: stats?.handled != null ? `${stats.handled}%` : "—", icon: Zap, color: "#00ff88" },
  ]
```

Replace with:
```tsx
  const activeAccounts = accounts.filter(a => a.is_active)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibleEmails: any[] = data
    ? (activeAccountId ? data.emails.filter((e: any) => e.account_id === activeAccountId) : data.emails)
    : []
  const visibleEmailIds = new Set(visibleEmails.map((e: any) => e.id as string))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibleActions: any[] = data
    ? (activeAccountId ? data.actions.filter((a: any) => visibleEmailIds.has(a.digest_email_id)) : data.actions)
    : []

  const visiblePending = visibleActions.filter((a: any) => a.status === "pending").length
  const visibleTotal = visibleEmails.length
  const visibleHandled = visibleTotal > 0 ? Math.round(((visibleTotal - visiblePending) / visibleTotal) * 100) : 100

  const STAT_CARDS = [
    { label: "Emails Today", value: stats ? visibleTotal : "—", icon: Inbox, color: "#06b6d4" },
    { label: "Accounts", value: stats ? (activeAccountId ? 1 : activeAccounts.length) : "—", icon: Mail, color: "#00d4ff" },
    { label: "Pending", value: stats ? visiblePending : "—", icon: Clock, color: "#f97316" },
    { label: "Auto-handled", value: stats ? `${visibleHandled}%` : "—", icon: Zap, color: "#00ff88" },
  ]
```

- [ ] **Step 4: Wire AccountSelector in the header**

Find (line ~140):
```tsx
          <AccountSelector />
```

Replace with:
```tsx
          <AccountSelector
            accounts={activeAccounts}
            emails={data?.emails || []}
            activeId={activeAccountId}
            onSelect={setActiveAccountId}
          />
```

- [ ] **Step 5: Pass visibleEmails and visibleActions downstream**

Find (lines ~228–231):
```tsx
          <DigestOverview digest={data.digest} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
            <EmailList emails={data.emails} />
            <ActionQueue actions={data.actions} onAction={() => fetchLatest()} />
```

Replace with:
```tsx
          <DigestOverview digest={data.digest} emails={visibleEmails} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
            <EmailList emails={visibleEmails} />
            <ActionQueue actions={visibleActions} onAction={() => fetchLatest()} />
```

- [ ] **Step 6: TypeScript check — expect clean**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: filter dashboard by account — wire AccountSelector tabs to digest data"
```
