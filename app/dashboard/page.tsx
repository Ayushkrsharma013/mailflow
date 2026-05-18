"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, RefreshCw, Mail, Zap, Clock, Activity, Inbox, CheckCircle2, AlertCircle } from "lucide-react"
import Shell from "@/components/Shell"
import DigestOverview from "@/components/dashboard/DigestOverview"
import EmailList from "@/components/dashboard/EmailList"
import ActionQueue from "@/components/dashboard/ActionQueue"
import AccountSelector from "@/components/dashboard/AccountSelector"
import ChatWidget from "@/components/chat/ChatWidget"

function SkeletonPulse({ h, w = "100%", r = 10 }: { h: number; w?: string | number; r?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.25, 0.5, 0.25] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ height: h, width: w, borderRadius: r, background: "rgba(255,255,255,0.04)" }}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 28 }}>
        {[...Array(5)].map((_, i) => (<SkeletonPulse key={i} h={100} r={12} />))}
      </div>
      <SkeletonPulse h={52} r={10} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (<SkeletonPulse key={i} h={72} r={10} />))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(2)].map((_, i) => (<SkeletonPulse key={i} h={110} r={10} />))}
        </div>
      </div>
    </div>
  )
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ digest: Record<string, any>; emails: any[]; actions: any[] } | null>(null)
  const [stats, setStats] = useState<{ emailsToday: number; accounts: number; pending: number; handled: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null)

  async function fetchLatest() {
    setLoading(true)
    try {
      const res = await fetch("/mailflow/api/digest/latest")
      const json = await res.json()
      setData(json)
      if (json.digest) setLastRefreshed(json.digest.created_at)

      // Derive stats
      const accountsRes = await fetch("/mailflow/api/gmail/accounts")
      const accountsData = await accountsRes.json()
      const activeAccounts = (accountsData.accounts || []).filter((a: { is_active: boolean }) => a.is_active).length
      const pending = (json.actions || []).filter((a: { status: string }) => a.status === "pending").length
      const total = (json.emails || []).length
      const handled = total > 0 ? Math.round(((total - pending) / total) * 100) : 100

      setStats({ emailsToday: total, accounts: activeAccounts, pending, handled })
    } catch {
      setError("Failed to load digest data.")
    }
    setLoading(false)
  }

  async function runDigest() {
    setRunning(true)
    setError("")
    try {
      const res = await fetch("/mailflow/api/digest/run", { method: "POST" })
      const json = await res.json()
      if (json.error) { setError(json.error) } else { await fetchLatest() }
    } catch {
      setError("Network error — try again.")
    }
    setRunning(false)
  }

  useEffect(() => { fetchLatest() }, [])

  const STAT_CARDS = [
    { label: "Emails Today", value: stats?.emailsToday ?? "—", icon: Inbox, color: "#06b6d4" },
    { label: "Accounts", value: stats?.accounts ?? "—", icon: Mail, color: "#00d4ff" },
    { label: "Pending", value: stats?.pending ?? "—", icon: Clock, color: "#f97316" },
    { label: "Auto-handled", value: stats?.handled != null ? `${stats.handled}%` : "—", icon: Zap, color: "#00ff88" },
  ]

  return (
    <Shell>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,136,204,0.08))",
              border: "1px solid rgba(0,212,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={11} style={{ color: "#00d4ff" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em" }}>
              Inbox Digest
            </h1>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(221,232,240,0.35)", marginLeft: 31 }}>
            AI-processed summary of your Gmail inbox
            {lastRefreshed && (
              <span style={{ marginLeft: 8, color: "rgba(221,232,240,0.18)" }}>
                · refreshed {relativeTime(lastRefreshed)}
              </span>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AccountSelector />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={runDigest}
            disabled={running}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: running ? "rgba(0,212,255,0.08)" : "linear-gradient(135deg,#00b4db,#0083b0)",
              color: running ? "rgba(0,212,255,0.5)" : "#020a14",
              fontSize: 13, fontWeight: 600,
              cursor: running ? "not-allowed" : "pointer",
              boxShadow: running ? "none" : "0 0 20px rgba(0,212,255,0.25)",
              transition: "all 0.18s ease",
            }}
          >
            <motion.div
              animate={running ? { rotate: 360 } : { rotate: 0 }}
              transition={running ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw size={13} />
            </motion.div>
            {running ? "Checking..." : "Check Inbox"}
          </motion.button>
        </div>
      </motion.div>

      {/* Stats strip */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24,
          }}
        >
          {STAT_CARDS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.label} style={{
                borderRadius: 10, padding: "14px 16px",
                background: `${s.color}08`, border: `1px solid ${s.color}15`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: `${s.color}99`, fontFamily: "monospace" }}>{s.label}</span>
                  <Icon size={13} style={{ color: s.color, opacity: 0.5 }} />
                </div>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </span>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 20,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <AlertCircle size={13} style={{ color: "#fca5a5", flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#fca5a5", margin: 0, flex: 1 }}>{error}</p>
            <button
              onClick={() => setError("")}
              style={{ background: "none", border: "none", color: "rgba(252,165,165,0.5)", cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : data?.digest ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <DigestOverview digest={data.digest} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
            <EmailList emails={data.emails} />
            <ActionQueue actions={data.actions} onAction={() => fetchLatest()} />
          </div>

          {/* Recent activity feed */}
          {data.actions && data.actions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              style={{
                marginTop: 24, borderRadius: 12, padding: "16px 20px",
                background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Activity size={12} style={{ color: "rgba(221,232,240,0.3)" }} />
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(221,232,240,0.28)", fontFamily: "monospace" }}>Recent Activity</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(221,232,240,0.15)", marginLeft: "auto" }}>
                  {data.actions.length} actions
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.actions.slice(0, 5).map((action: any, i: number) => {
                  const payload = action.action_payload || {}
                  const statusColors: Record<string, string> = { pending: "#f97316", approved: "#00ff88", executed: "#00d4ff", rejected: "#ef4444", failed: "#ef4444" }
                  const color = statusColors[action.status] || "#64748b"
                  return (
                    <div key={action.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, padding: "4px 0" }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ color: "rgba(221,232,240,0.5)", flex: 1 }}>
                        {action.action_type === "send_reply" ? `Reply to ${payload.to || "recipient"}` : action.action_type}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, fontFamily: "monospace", textTransform: "uppercase",
                        padding: "1px 6px", borderRadius: 3, color, background: `${color}12`,
                      }}>
                        {action.status}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(221,232,240,0.2)", fontFamily: "monospace" }}>
                        {relativeTime(action.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "88px 24px", textAlign: "center",
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 16, marginBottom: 20,
            background: "rgba(0,212,255,0.05)",
            border: "1px solid rgba(0,212,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Inbox size={28} style={{ color: "rgba(0,212,255,0.35)" }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(221,232,240,0.5)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            No digests yet
          </p>
          <p style={{ fontSize: 13, color: "rgba(221,232,240,0.28)", maxWidth: 280, lineHeight: 1.65 }}>
            Click <strong style={{ color: "rgba(0,212,255,0.55)" }}>Check Inbox</strong> to run your first AI digest
            {stats && stats.accounts === 0 ? (
              <span>. Then <strong style={{ color: "rgba(0,212,255,0.55)" }}>connect a Gmail account</strong> in Accounts.</span>
            ) : ""}
          </p>
          {stats && stats.accounts === 0 && (
            <a
              href="/mailflow/accounts"
              style={{
                marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 18px", borderRadius: 8,
                background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                color: "rgba(0,212,255,0.7)", fontSize: 12.5, fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <Mail size={12} />
              Connect Account
            </a>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={runDigest}
            disabled={running}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 22px", borderRadius: 8, border: "none", marginTop: 20,
              background: running ? "rgba(0,212,255,0.08)" : "linear-gradient(135deg,#00b4db,#0083b0)",
              color: running ? "rgba(0,212,255,0.5)" : "#020a14",
              fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
              boxShadow: running ? "none" : "0 0 20px rgba(0,212,255,0.25)",
            }}
          >
            <RefreshCw size={13} />
            {running ? "Checking..." : "Run First Digest"}
          </motion.button>
        </motion.div>
      )}

      <ChatWidget contextLabel={data?.digest ? `Today's Digest · ${data.emails?.length || 0} emails` : undefined} />
    </Shell>
  )
}
