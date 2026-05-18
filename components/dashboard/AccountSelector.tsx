"use client"

import { useEffect, useState } from "react"
import { Mail } from "lucide-react"

export default function AccountSelector() {
  const [accounts, setAccounts] = useState<{ id: string; email: string; is_active: boolean }[]>([])

  useEffect(() => {
    fetch("/mailflow/api/gmail/accounts")
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []))
      .catch(() => {})
  }, [])

  const active = accounts.filter(a => a.is_active)
  if (active.length === 0) return null

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {active.map(a => (
        <div
          key={a.id}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 7,
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.15)",
          }}
        >
          <Mail size={11} style={{ color: "#00d4ff", flexShrink: 0 }} />
          <span style={{
            fontSize: 11, fontFamily: "monospace",
            color: "rgba(221,232,240,0.55)",
            letterSpacing: "-0.01em",
          }}>
            {a.email}
          </span>
        </div>
      ))}
    </div>
  )
}
