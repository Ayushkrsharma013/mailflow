"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Mail, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { GalaxyBg } from "@/components/landing/GalaxyBg"

function LoginForm() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const router      = useRouter()
  const searchParams = useSearchParams()
  const redirect    = searchParams.get("redirect") || "/dashboard"
  const supabase    = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.push(redirect)
  }

  return (
    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Email */}
      <div>
        <label style={{
          display: "block", fontSize: 11.5, fontWeight: 500,
          color: "rgba(221,232,240,0.45)", marginBottom: 7,
          textTransform: "uppercase", letterSpacing: "0.07em",
          fontFamily: "monospace",
        }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          style={{
            width: "100%", padding: "11px 14px",
            borderRadius: 9, outline: "none",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(0,212,255,0.12)",
            color: "#dde8f0", fontSize: 14,
            fontFamily: "inherit",
            transition: "border-color 0.15s ease",
            boxSizing: "border-box",
          }}
          onFocus={e => { e.target.style.borderColor = "rgba(0,212,255,0.45)" }}
          onBlur={e => { e.target.style.borderColor = "rgba(0,212,255,0.12)" }}
        />
      </div>

      {/* Password */}
      <div>
        <label style={{
          display: "block", fontSize: 11.5, fontWeight: 500,
          color: "rgba(221,232,240,0.45)", marginBottom: 7,
          textTransform: "uppercase", letterSpacing: "0.07em",
          fontFamily: "monospace",
        }}>
          Password
        </label>
        <div style={{ position: "relative" }}>
          <input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: "100%", padding: "11px 42px 11px 14px",
              borderRadius: 9, outline: "none",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(0,212,255,0.12)",
              color: "#dde8f0", fontSize: 14,
              fontFamily: "inherit",
              transition: "border-color 0.15s ease",
              boxSizing: "border-box",
            }}
            onFocus={e => { e.target.style.borderColor = "rgba(0,212,255,0.45)" }}
            onBlur={e => { e.target.style.borderColor = "rgba(0,212,255,0.12)" }}
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 2,
              color: "rgba(221,232,240,0.3)", display: "flex", alignItems: "center",
            }}
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}>
              <AlertCircle size={13} style={{ color: "#fca5a5", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: "#fca5a5" }}>{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={loading}
        whileHover={!loading ? { scale: 1.01 } : {}}
        whileTap={!loading ? { scale: 0.98 } : {}}
        style={{
          marginTop: 4,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "12px 20px",
          borderRadius: 9, border: "none",
          background: loading
            ? "rgba(0,212,255,0.1)"
            : "linear-gradient(135deg, #00b4db, #0083b0)",
          color: loading ? "rgba(0,212,255,0.45)" : "#000d14",
          fontSize: 14, fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 0 24px rgba(0,212,255,0.3)",
          transition: "background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
        }}
      >
        {loading ? (
          <motion.span
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            Signing in…
          </motion.span>
        ) : (
          <>
            Sign In
            <ArrowRight size={14} />
          </>
        )}
      </motion.button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#000000",
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
      padding: "24px",
    }}>
      {/* Galaxy background */}
      <GalaxyBg />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 400,
          padding: "36px 32px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.13)",
          boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06) inset",
        }}
      >
        {/* Top cyan glow line */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)",
          borderRadius: 1,
        }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(0,212,255,0.22), rgba(0,136,204,0.08))",
            border: "1px solid rgba(0,212,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Mail size={15} style={{ color: "#00d4ff" }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#e8f4ff", letterSpacing: "-0.02em" }}>
            MailFlow
          </span>
          <span style={{
            fontSize: 9.5, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.22)",
            color: "#00d4ff", fontFamily: "monospace", letterSpacing: "0.06em",
          }}>
            AI
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: "#edf6ff",
          letterSpacing: "-0.03em", marginBottom: 6,
        }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 13, color: "rgba(221,232,240,0.38)", marginBottom: 28, lineHeight: 1.55 }}>
          Sign in to manage your AI-organized inbox.
        </p>

        <Suspense fallback={
          <div style={{ fontSize: 13, color: "rgba(221,232,240,0.3)" }}>Loading…</div>
        }>
          <LoginForm />
        </Suspense>

        {/* Footer link */}
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(221,232,240,0.25)", marginTop: 24 }}>
          Back to{" "}
          <Link href="/" style={{ color: "rgba(0,212,255,0.55)", textDecoration: "none" }}>
            home
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
