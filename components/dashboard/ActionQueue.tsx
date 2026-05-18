"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Pencil, Send } from "lucide-react"

interface ActionItem {
  id: string
  status: string
  action_type: string
  action_payload?: Record<string, unknown> | null
}

export default function ActionQueue({ actions, onAction }: { actions: ActionItem[]; onAction: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const pending = actions.filter(a => a.status === "pending")

  async function handleAction(id: string, status: string, replyBody?: string) {
    setLoadingId(id)
    await fetch(`/mailflow/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, replyBody, approvedBy: "web" }),
    })
    setEditingId(null)
    setLoadingId(null)
    onAction()
  }

  if (pending.length === 0) {
    return (
      <div>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "rgba(221,232,240,0.3)",
          fontFamily: "monospace", marginBottom: 12,
        }}>
          Pending Actions
        </p>
        <div style={{
          padding: "32px 24px", borderRadius: 12, textAlign: "center",
          background: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          <p style={{ fontSize: 13, color: "rgba(221,232,240,0.28)" }}>
            All caught up — no pending actions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <p style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.1em", color: "rgba(221,232,240,0.3)",
          fontFamily: "monospace",
        }}>
          Pending Actions
        </p>
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "monospace",
          color: "#f97316",
          background: "rgba(249,115,22,0.12)",
          border: "1px solid rgba(249,115,22,0.2)",
          padding: "1px 6px", borderRadius: 4,
        }}>
          {pending.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pending.map((action, i) => {
          const payload = (action.action_payload as Record<string, unknown>) || {}
          const subject = (payload.subject as string) || "Reply"
          const to = (payload.to as string) || "unknown"
          const draftBody = (payload.replyBody as string) || ""
          const isEditing = editingId === action.id
          const isLoading = loadingId === action.id

          return (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                borderRadius: 10,
                background: "rgba(249,115,22,0.04)",
                borderLeft: "2.5px solid rgba(249,115,22,0.4)",
                border: "1px solid rgba(249,115,22,0.12)",
                borderLeftWidth: 2.5,
                overflow: "hidden",
                opacity: isLoading ? 0.5 : 1,
                transition: "opacity 0.15s ease",
              }}
            >
              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#edf6ff" }}>
                  {subject}
                </p>
                <p style={{ fontSize: 11, color: "rgba(221,232,240,0.35)", marginTop: 2 }}>
                  To: {to}
                </p>

                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div
                      key="editing"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden", marginTop: 10 }}
                    >
                      <textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        rows={4}
                        style={{
                          width: "100%", padding: "10px 12px",
                          borderRadius: 7,
                          background: "rgba(0,212,255,0.04)",
                          border: "1px solid rgba(0,212,255,0.2)",
                          color: "#dde8f0", fontSize: 12, lineHeight: 1.6,
                          resize: "none", outline: "none",
                          fontFamily: "inherit",
                          transition: "border-color 0.15s ease",
                        }}
                        onFocus={e => { e.target.style.borderColor = "rgba(0,212,255,0.45)" }}
                        onBlur={e => { e.target.style.borderColor = "rgba(0,212,255,0.2)" }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => handleAction(action.id, "approved", editBody)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6, border: "none",
                            background: "rgba(0,255,136,0.12)",
                            color: "#00ff88", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", transition: "background 0.15s ease",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(0,255,136,0.2)" }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,255,136,0.12)" }}
                        >
                          <Send size={11} />
                          Send Edited
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            padding: "6px 12px", borderRadius: 6, border: "none",
                            background: "rgba(255,255,255,0.05)",
                            color: "rgba(221,232,240,0.4)", fontSize: 11,
                            cursor: "pointer", transition: "background 0.15s ease",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {draftBody && (
                        <div style={{
                          marginTop: 10, padding: "9px 11px",
                          borderRadius: 7,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}>
                          <p style={{
                            fontSize: 12, color: "rgba(221,232,240,0.55)",
                            lineHeight: 1.55,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}>
                            {draftBody}
                          </p>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button
                          onClick={() => handleAction(action.id, "approved")}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6, border: "none",
                            background: "rgba(0,255,136,0.1)",
                            color: "#00ff88", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", transition: "background 0.15s ease",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(0,255,136,0.18)" }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(0,255,136,0.1)" }}
                        >
                          <Check size={11} />
                          Approve
                        </button>
                        <button
                          onClick={() => { setEditingId(action.id); setEditBody(draftBody) }}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6, border: "none",
                            background: "rgba(251,191,36,0.08)",
                            color: "rgba(251,191,36,0.7)", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", transition: "background 0.15s ease",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(251,191,36,0.15)" }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(251,191,36,0.08)" }}
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleAction(action.id, "rejected")}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 6, border: "none",
                            background: "rgba(239,68,68,0.08)",
                            color: "rgba(239,68,68,0.7)", fontSize: 11, fontWeight: 600,
                            cursor: "pointer", transition: "background 0.15s ease",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(239,68,68,0.15)" }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(239,68,68,0.08)" }}
                        >
                          <X size={11} />
                          Reject
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
