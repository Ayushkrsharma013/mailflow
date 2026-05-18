"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { LayoutDashboard, Mail, Settings, LogOut } from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts",  label: "Accounts",  icon: Mail },
  { href: "/settings",  label: "Settings",  icon: Settings },
]

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [signOutHovered, setSignOutHovered] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "#000000",
      fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
      color: "#dde8f0",
    }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 180, flexShrink: 0,
        background: "#02050a",
        borderRight: "1px solid rgba(0,212,255,0.06)",
        display: "flex", flexDirection: "column",
        padding: "20px 12px",
      }}>

        {/* Logo */}
        <Link href="/dashboard" style={{
          textDecoration: "none",
          display: "flex", alignItems: "center",
          padding: "4px 8px", marginBottom: 24,
        }}>
          <img
            src="/mailflow/logo/mailflow-logo-dark.svg"
            alt="MailFlow"
            width={140}
            height="auto"
          />
        </Link>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV_ITEMS.map(item => {
            const active = pathname === `${item.href}`
            const Icon   = item.icon
            return (
              <Link
                key={item.href}
                href={`${item.href}`}
                style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  color: active ? "#e8f4ff" : "rgba(221,232,240,0.38)",
                  background: active ? "rgba(0,212,255,0.07)" : "transparent",
                  border: active ? "1px solid rgba(0,212,255,0.13)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{
                      position: "absolute", left: 0, top: "22%", bottom: "22%",
                      width: 2.5, borderRadius: 2, background: "#00d4ff",
                    }}
                  />
                )}
                <Icon size={15} style={{ color: active ? "#00d4ff" : "rgba(221,232,240,0.3)", flexShrink: 0 }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          onMouseEnter={() => setSignOutHovered(true)}
          onMouseLeave={() => setSignOutHovered(false)}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "8px 10px", borderRadius: 8,
            background: "transparent", border: "none",
            cursor: "pointer", width: "100%",
            fontSize: 13, color: signOutHovered ? "rgba(221,232,240,0.45)" : "rgba(221,232,240,0.28)",
            transition: "color 0.15s ease",
          }}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  )
}
