"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState } from "react"

const CAT_COLORS: Record<string, string> = {
  urgent:        "#ef4444",
  action_needed: "#f97316",
  fyi:           "#06b6d4",
  promotion:     "#a78bfa",
  spam:          "#64748b",
}

interface EmailItem {
  id: string
  subject?: string | null
  from_name?: string | null
  from_email?: string | null
  category: string
  ai_summary?: string | null
  ai_draft_reply?: string | null
}

function AvatarCircle({ name, color }: { name: string; color: string }) {
  const letter = (name || "?")[0].toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: `${color}18`,
      border: `1px solid ${color}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, color,
      fontFamily: "monospace",
    }}>
      {letter}
    </div>
  )
}

function EmailRow({ email, index }: { email: EmailItem; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const color = CAT_COLORS[email.category] || "#64748b"
  const senderName = email.from_name || email.from_email || "Unknown"

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.055, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => setExpanded(e => !e)}
      style={{
        borderRadius: 10,
        background: expanded ? `${color}06` : "rgba(255,255,255,0.018)",
        border: `1px solid ${expanded ? color + "22" : "rgba(255,255,255,0.05)"}`,
        cursor: "pointer",
        transition: "background 0.18s ease, border-color 0.18s ease",
        overflow: "hidden",
      }}
    >
      {/* Top accent strip */}
      <div style={{
        height: 2,
        background: expanded
          ? `linear-gradient(90deg,${color},${color}40,transparent)`
          : "transparent",
        transition: "background 0.2s ease",
      }} />

      <div style={{ padding: "9px 11px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AvatarCircle name={senderName} color={color} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <p style={{
                fontSize: 13, fontWeight: 500, color: "#edf6ff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {email.subject || "(no subject)"}
              </p>
              <span style={{
                flexShrink: 0, fontSize: 9, fontWeight: 600,
                fontFamily: "monospace", textTransform: "uppercase",
                letterSpacing: "0.06em",
                color, display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
                {email.category.replace(/_/g, " ")}
              </span>
            </div>
            <p style={{ fontSize: 11, color: "rgba(221,232,240,0.35)", marginTop: 2 }}>
              {senderName}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              {email.ai_summary && (
                <p style={{
                  fontSize: 12, color: "rgba(221,232,240,0.5)",
                  lineHeight: 1.6, marginTop: 10,
                }}>
                  {email.ai_summary}
                </p>
              )}

              {email.ai_draft_reply && (
                <div style={{
                  marginTop: 10, padding: "10px 12px",
                  borderRadius: 7,
                  background: "rgba(0,212,255,0.04)",
                  borderLeft: "2.5px solid rgba(0,212,255,0.35)",
                }}>
                  <p style={{
                    fontSize: 9, fontWeight: 600, fontFamily: "monospace",
                    textTransform: "uppercase", letterSpacing: "0.09em",
                    color: "#00d4ff", opacity: 0.6, marginBottom: 5,
                  }}>
                    AI DRAFT
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(221,232,240,0.62)", lineHeight: 1.6 }}>
                    {email.ai_draft_reply}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function EmailList({ emails }: { emails: EmailItem[] }) {
  if (emails.length === 0) {
    return (
      <div style={{
        padding: "32px 24px", borderRadius: 12, textAlign: "center",
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}>
        <p style={{ fontSize: 13, color: "rgba(221,232,240,0.28)" }}>
          No emails in this digest.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "rgba(221,232,240,0.3)",
          fontFamily: "monospace",
        }}>
          Emails
        </p>
        <span style={{
          fontSize: 10, fontFamily: "monospace",
          color: "rgba(221,232,240,0.2)",
        }}>
          {emails.length} total
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {emails.map((email, i) => (
          <EmailRow key={email.id} email={email} index={i} />
        ))}
      </div>
    </div>
  )
}
