"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, RefreshCw } from "lucide-react"
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
      style={{
        height: h, width: w, borderRadius: r,
        background: "rgba(255,255,255,0.04)",
      }}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div>
      {/* Category cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 28 }}>
        {[...Array(5)].map((_, i) => (
          <SkeletonPulse key={i} h={100} r={12} />
        ))}
      </div>
      {/* Summary skeleton */}
      <SkeletonPulse h={52} r={10} />

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <SkeletonPulse key={i} h={72} r={10} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...Array(2)].map((_, i) => (
            <SkeletonPulse key={i} h={110} r={10} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ digest: Record<string, any>; emails: any[]; actions: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")

  async function fetchLatest() {
    setLoading(true)
    const res = await fetch("/mailflow/api/digest/latest")
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  async function runDigest() {
    setRunning(true)
    setError("")
    const res = await fetch("/mailflow/api/digest/run", { method: "POST" })
    const json = await res.json()
    if (json.error) {
      setError(json.error)
    } else {
      await fetchLatest()
    }
    setRunning(false)
  }

  useEffect(() => { fetchLatest() }, [])

  return (
    <Shell>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}
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
            <h1 style={{
              fontSize: 20, fontWeight: 700, color: "#edf6ff",
              letterSpacing: "-0.03em",
            }}>
              Inbox Digest
            </h1>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(221,232,240,0.35)", marginLeft: 31 }}>
            AI-processed summary of your Gmail inbox
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
              background: running
                ? "rgba(0,212,255,0.08)"
                : "linear-gradient(135deg,#00b4db,#0083b0)",
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

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 20,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <p style={{ fontSize: 12.5, color: "#fca5a5" }}>{error}</p>
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : data?.digest ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <DigestOverview digest={data.digest} />

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 24,
          }}>
            <EmailList emails={data.emails} />
            <ActionQueue actions={data.actions} onAction={() => fetchLatest()} />
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "72px 24px", textAlign: "center",
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: 14, marginBottom: 16,
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={22} style={{ color: "rgba(0,212,255,0.45)" }} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(221,232,240,0.55)", marginBottom: 6 }}>
            No digests yet
          </p>
          <p style={{ fontSize: 13, color: "rgba(221,232,240,0.25)", maxWidth: 260, lineHeight: 1.65 }}>
            Click <strong style={{ color: "rgba(0,212,255,0.6)" }}>Check Inbox</strong> to run your first AI digest.
          </p>
        </motion.div>
      )}

      <ChatWidget contextLabel={data?.digest ? `Today's Digest · ${data.emails?.length || 0} emails` : undefined} />
    </Shell>
  )
}
