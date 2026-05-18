"use client"

import { motion } from "framer-motion"

const CATS = [
  { key: "urgent",        label: "Urgent", color: "#ef4444" },
  { key: "action_needed", label: "Action", color: "#f97316" },
  { key: "fyi",           label: "FYI",    color: "#06b6d4" },
  { key: "promotion",     label: "Promo",  color: "#a78bfa" },
  { key: "spam",          label: "Spam",   color: "#64748b" },
]

export default function DigestOverview({ digest }: { digest: Record<string, unknown> }) {
  const categories = (digest.categories as Record<string, number>) || {}
  const total = Object.values(categories).reduce((s, n) => s + (n as number), 0)

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 14 }}>
        {CATS.map(({ key, label, color }, i) => {
          const count = (categories[key] as number) || 0
          const pct   = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              style={{
                borderRadius: 12, overflow: "hidden",
                background: `${color}09`,
                border: `1px solid ${color}22`,
              }}
            >
              {/* Accent strip */}
              <div style={{
                height: 2.5,
                background: `linear-gradient(90deg,${color},${color}40,transparent)`,
              }} />

              <div style={{ padding: "14px 16px 12px" }}>
                <p style={{
                  fontSize: 9.5, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.09em", color, fontFamily: "monospace", marginBottom: 8,
                }}>
                  {label}
                </p>
                <p style={{
                  fontSize: 28, fontWeight: 700, color: "#edf6ff",
                  letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 12,
                }}>
                  {count}
                </p>

                {/* Fill bar */}
                <div style={{ height: 2.5, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: i * 0.07 + 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                    style={{ height: "100%", background: color, borderRadius: 2 }}
                  />
                </div>
                <p style={{ fontSize: 9, color: "rgba(221,232,240,0.28)", marginTop: 5 }}>
                  {pct}%
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {Boolean(digest.summary) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.35 }}
          style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: "14px 18px", borderRadius: 10,
            background: "rgba(0,212,255,0.035)",
            border: "1px solid rgba(0,212,255,0.1)",
          }}
        >
          <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: "#00d4ff", opacity: 0.45, flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: "rgba(221,232,240,0.58)", lineHeight: 1.68 }}>
            {String(digest.summary)}
          </p>
        </motion.div>
      )}
    </div>
  )
}
