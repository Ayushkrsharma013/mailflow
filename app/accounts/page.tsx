"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Shield, ExternalLink } from "lucide-react";
import Shell from "@/components/Shell";

interface GmailAccountSummary {
  id: string;
  email: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SkeletonLine({ w = "100%" }: { w?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.25, 0.5, 0.25] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ height: 12, width: w, borderRadius: 6, background: "rgba(255,255,255,0.04)" }}
    />
  );
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<GmailAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  async function fetchAccounts() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/mailflow/api/gmail/accounts");
      const data = await res.json();
      if (data.error) { setError(data.error); } else { setAccounts(data.accounts || []); }
    } catch {
      setError("Failed to load accounts.");
    }
    setLoading(false);
  }

  useEffect(() => { fetchAccounts(); }, []);

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      await fetch("/mailflow/api/gmail/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id }),
      });
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch {
      setError("Failed to disconnect account.");
    }
    setConfirmDeleteId(null);
    setDeleteLoading(false);
  }

  async function handleSync(accountId: string) {
    setSyncingId(accountId);
    try {
      const res = await fetch("/mailflow/api/digest/run", { method: "POST" });
      const data = await res.json();
      if (!data.error) await fetchAccounts();
    } catch { /* ok */ }
    setSyncingId(null);
  }

  const activeCount = accounts.filter(a => a.is_active).length;

  return (
    <Shell>
      {/* Header */}
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
              <Mail size={11} style={{ color: "#00d4ff" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em" }}>
              Connected Accounts
            </h1>
            {activeCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                padding: "2px 8px", borderRadius: 99,
                background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.15)",
                color: "rgba(0,255,136,0.7)",
              }}>
                {activeCount} active
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(221,232,240,0.35)", marginLeft: 31 }}>
            Connect your Gmail accounts. MailFlow reads, categorizes, and manages emails across all connected inboxes.
          </p>
        </div>

        <a
          href="/mailflow/api/auth/google"
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 18px", borderRadius: 8, textDecoration: "none",
            background: "linear-gradient(135deg,#00b4db,#0083b0)",
            color: "#020a14", fontSize: 13, fontWeight: 600,
            boxShadow: "0 0 20px rgba(0,212,255,0.25)",
          }}
        >
          <Plus size={13} />
          Add Account
        </a>
      </motion.div>

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
            <XCircle size={13} style={{ color: "#fca5a5", flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#fca5a5", margin: 0, flex: 1 }}>{error}</p>
            <button
              onClick={() => setError("")}
              style={{ background: "none", border: "none", color: "rgba(252,165,165,0.5)", cursor: "pointer", fontSize: 13 }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ padding: 20, borderRadius: 12, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <SkeletonLine w="30%" />
              <div style={{ height: 8 }} />
              <SkeletonLine w="45%" />
            </div>
          ))}
        </div>
      ) : accounts.length === 0 ? (
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
            background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Mail size={28} style={{ color: "rgba(0,212,255,0.3)" }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "rgba(221,232,240,0.5)", marginBottom: 8, letterSpacing: "-0.02em" }}>
            No accounts connected
          </p>
          <p style={{ fontSize: 13, color: "rgba(221,232,240,0.28)", maxWidth: 300, lineHeight: 1.65, marginBottom: 20 }}>
            Connect a Gmail account with OAuth 2.0 — we never see your password. MailFlow will start organizing your inbox immediately.
          </p>
          <a
            href="/mailflow/api/auth/google"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 22px", borderRadius: 8, textDecoration: "none",
              background: "linear-gradient(135deg,#00b4db,#0083b0)",
              color: "#020a14", fontSize: 13, fontWeight: 600,
              boxShadow: "0 0 20px rgba(0,212,255,0.25)",
            }}
          >
            <Plus size={13} />
            Connect Gmail Account
          </a>
          <div style={{
            marginTop: 28, display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.06)",
          }}>
            <Shield size={11} style={{ color: "rgba(0,212,255,0.35)" }} />
            <span style={{ fontSize: 11, color: "rgba(221,232,240,0.3)" }}>
              OAuth 2.0 · Read-only access · Encrypted at rest
            </span>
          </div>
        </motion.div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((account, i) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                borderRadius: 12, overflow: "hidden",
                background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Top accent strip */}
              <div style={{
                height: 2.5,
                background: account.is_active
                  ? "linear-gradient(90deg, #00ff88, #00ff8820, transparent)"
                  : "linear-gradient(90deg, #ef4444, #ef444420, transparent)",
              }} />

              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Avatar circle */}
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: account.is_active ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)",
                      border: `1px solid ${account.is_active ? "rgba(0,255,136,0.15)" : "rgba(239,68,68,0.15)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: 700, fontFamily: "monospace",
                        color: account.is_active ? "#00ff88" : "#ef4444",
                      }}>
                        {(account.email || "?")[0].toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: "#edf6ff", letterSpacing: "-0.01em" }}>
                          {account.email}
                        </p>
                        <span style={{
                          display: "flex", alignItems: "center", gap: 4,
                          fontSize: 10, fontWeight: 600, fontFamily: "monospace",
                          padding: "2px 7px", borderRadius: 4,
                          color: account.is_active ? "rgba(0,255,136,0.7)" : "rgba(239,68,68,0.7)",
                          background: account.is_active ? "rgba(0,255,136,0.06)" : "rgba(239,68,68,0.06)",
                          border: `1px solid ${account.is_active ? "rgba(0,255,136,0.12)" : "rgba(239,68,68,0.12)"}`,
                        }}>
                          {account.is_active
                            ? <><CheckCircle size={9} /> Active</>
                            : <><XCircle size={9} /> Inactive</>
                          }
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(221,232,240,0.3)" }}>
                          <Clock size={9} />
                          {account.last_synced_at
                            ? `Last synced ${relativeTime(account.last_synced_at)}`
                            : "Never synced"}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(221,232,240,0.15)" }}>
                          Connected {relativeTime(account.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleSync(account.id)}
                      disabled={syncingId === account.id || !account.is_active}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "6px 12px", borderRadius: 6,
                        background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.1)",
                        color: "rgba(0,212,255,0.6)", fontSize: 11.5, fontWeight: 600,
                        cursor: syncingId === account.id || !account.is_active ? "not-allowed" : "pointer",
                        fontFamily: "inherit", opacity: account.is_active ? 1 : 0.4,
                      }}
                    >
                      <motion.div
                        animate={syncingId === account.id ? { rotate: 360 } : { rotate: 0 }}
                        transition={syncingId === account.id ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                      >
                        <RefreshCw size={11} />
                      </motion.div>
                      Sync Now
                    </motion.button>

                    {confirmDeleteId === account.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => handleDelete(account.id)}
                          disabled={deleteLoading}
                          style={{
                            padding: "6px 10px", borderRadius: 5, border: "none",
                            background: "rgba(239,68,68,0.12)", color: "#fca5a5",
                            fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          {deleteLoading ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: "6px 10px", borderRadius: 5, border: "none",
                            background: "rgba(255,255,255,0.05)", color: "rgba(221,232,240,0.4)",
                            fontSize: 10.5, cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(account.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          padding: "6px 12px", borderRadius: 6,
                          background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.08)",
                          color: "rgba(239,68,68,0.5)", fontSize: 11.5, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => {
                          (e.target as HTMLElement).style.color = "rgba(239,68,68,0.8)";
                          (e.target as HTMLElement).style.background = "rgba(239,68,68,0.08)";
                        }}
                        onMouseLeave={e => {
                          (e.target as HTMLElement).style.color = "rgba(239,68,68,0.5)";
                          (e.target as HTMLElement).style.background = "rgba(239,68,68,0.05)";
                        }}
                      >
                        <Trash2 size={10} />
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Add another account card */}
          <motion.a
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: accounts.length * 0.05, duration: 0.3 }}
            href="/mailflow/api/auth/google"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "18px", borderRadius: 12, textDecoration: "none",
              background: "rgba(255,255,255,0.01)", border: "1px dashed rgba(0,212,255,0.12)",
              color: "rgba(0,212,255,0.4)", fontSize: 13, fontWeight: 500,
              fontFamily: "inherit", cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.borderColor = "rgba(0,212,255,0.3)";
              (e.target as HTMLElement).style.color = "rgba(0,212,255,0.6)";
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.borderColor = "rgba(0,212,255,0.12)";
              (e.target as HTMLElement).style.color = "rgba(0,212,255,0.4)";
            }}
          >
            <Plus size={14} />
            Connect Another Account
          </motion.a>
        </div>
      )}
    </Shell>
  );
}
