"use client"

import { Inbox } from "lucide-react"

interface Props {
  accounts: { id: string; email: string; picture_url?: string | null }[]
  emails: { account_id: string }[]
  activeId: string | null
  onSelect: (id: string | null) => void
}

export default function AccountSelector({ accounts, emails, activeId, onSelect }: Props) {
  if (accounts.length === 0) return null

  const countFor = (id: string) => emails.filter(e => e.account_id === id).length

  const tabs = [
    { id: null as string | null, label: "All", count: emails.length, picture: null as string | null },
    ...accounts.map(a => ({ id: a.id as string | null, label: a.email, count: countFor(a.id), picture: a.picture_url ?? null })),
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
            {tab.id === null ? (
              <Inbox size={11} style={{ color: active ? "#00d4ff" : "rgba(221,232,240,0.25)", flexShrink: 0 }} />
            ) : tab.picture ? (
              <img
                src={tab.picture}
                alt=""
                width={14}
                height={14}
                style={{ borderRadius: "50%", flexShrink: 0, objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                background: "rgba(0,212,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, color: "#00d4ff", fontWeight: 700,
              }}>
                {tab.label[0]?.toUpperCase()}
              </div>
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
