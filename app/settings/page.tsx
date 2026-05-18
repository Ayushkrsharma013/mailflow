"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Sun, Moon, Sunrise, MessageCircle, AlertTriangle, Check, Globe, Clock, ChevronDown } from "lucide-react";
import Shell from "@/components/Shell";

const TIMEZONES = [
  "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific",
  "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney", "Pacific/Auckland",
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showTimezone, setShowTimezone] = useState(false);

  useEffect(() => {
    fetch("/mailflow/api/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings(d.settings); })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/mailflow/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save settings.");
    }
    setSaving(false);
  }

  function toggleScheduleTime(time: string) {
    const schedule = (settings.digest_schedule as string[]) || ["morning", "afternoon", "evening"];
    const next = schedule.includes(time) ? schedule.filter(t => t !== time) : [...schedule, time];
    setSettings(s => ({ ...s, digest_schedule: next }));
  }

  function toggleAutoArchive(cat: string) {
    const cats = (settings.auto_archive_categories as string[]) || ["promotion", "spam"];
    const next = cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat];
    setSettings(s => ({ ...s, auto_archive_categories: next }));
  }

  const scheduleLabels: Record<string, { label: string; icon: typeof Sun; time: string }> = {
    morning: { label: "Morning", icon: Sunrise, time: "7 AM" },
    afternoon: { label: "Afternoon", icon: Sun, time: "12 PM" },
    evening: { label: "Evening", icon: Moon, time: "6 PM" },
  };

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              animate={{ opacity: [0.25, 0.5, 0.25] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
              style={{ height: 120, borderRadius: 14, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}
            />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,136,204,0.08))",
              border: "1px solid rgba(0,212,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Settings size={11} style={{ color: "#00d4ff" }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em" }}>
              Settings
            </h1>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(221,232,240,0.35)", marginLeft: 31 }}>
            Configure your MailFlow preferences and notification channels.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: saved ? "rgba(0,255,136,0.12)" : saving ? "rgba(0,212,255,0.06)" : "linear-gradient(135deg,#00b4db,#0083b0)",
            color: saved ? "#00ff88" : saving ? "rgba(0,212,255,0.4)" : "#020a14",
            fontSize: 13, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            boxShadow: saved ? "0 0 12px rgba(0,255,136,0.15)" : saving ? "none" : "0 0 20px rgba(0,212,255,0.25)",
            fontFamily: "inherit",
            transition: "all 0.2s ease",
          }}
        >
          {saved ? <><Check size={13} /> Saved</> : saving ? "Saving..." : "Save Changes"}
        </motion.button>
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
            <AlertTriangle size={12} style={{ color: "#fca5a5", flexShrink: 0 }} />
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

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Section: Reply Preferences ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35 }}
          style={{
            borderRadius: 14, overflow: "hidden",
            background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#edf6ff", letterSpacing: "-0.01em" }}>Reply Preferences</p>
            <p style={{ fontSize: 11.5, color: "rgba(221,232,240,0.3)", marginTop: 2 }}>Control how AI drafts replies and what gets auto-archived.</p>
          </div>
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Tone */}
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "rgba(221,232,240,0.55)", marginBottom: 9 }}>
                Reply tone
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["professional", "casual", "direct"] as const).map(tone => (
                  <button
                    key={tone}
                    onClick={() => setSettings(s => ({ ...s, tone_style: tone }))}
                    style={{
                      padding: "7px 16px", borderRadius: 7,
                      fontSize: 12.5, fontWeight: 500, textTransform: "capitalize",
                      cursor: "pointer", fontFamily: "inherit",
                      color: settings.tone_style === tone ? "#fff" : "rgba(221,232,240,0.35)",
                      background: settings.tone_style === tone
                        ? "linear-gradient(135deg, #00b4db22, #0083b022)"
                        : "rgba(255,255,255,0.03)",
                      border: settings.tone_style === tone
                        ? "1px solid rgba(0,212,255,0.2)"
                        : "1px solid rgba(255,255,255,0.05)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-archive */}
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "rgba(221,232,240,0.55)", marginBottom: 9 }}>
                Auto-archive categories
              </label>
              <p style={{ fontSize: 11, color: "rgba(221,232,240,0.2)", marginBottom: 10 }}>
                Emails in these categories are automatically archived after digest.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["promotion", "spam", "fyi"].map(cat => {
                  const active = ((settings.auto_archive_categories as string[]) || ["promotion", "spam"]).includes(cat);
                  const catColors: Record<string, string> = { promotion: "#a78bfa", spam: "#64748b", fyi: "#06b6d4" };
                  const color = catColors[cat] || "#64748b";
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleAutoArchive(cat)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 7,
                        fontSize: 12, fontWeight: 500, textTransform: "capitalize",
                        cursor: "pointer", fontFamily: "inherit",
                        color: active ? color : "rgba(221,232,240,0.25)",
                        background: active ? `${color}12` : "rgba(255,255,255,0.02)",
                        border: active ? `1px solid ${color}25` : "1px solid rgba(255,255,255,0.04)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: active ? color : "transparent",
                        border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
                      }} />
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section: Digest Schedule ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          style={{
            borderRadius: 14, overflow: "hidden",
            background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#edf6ff", letterSpacing: "-0.01em" }}>Digest Schedule</p>
            <p style={{ fontSize: 11.5, color: "rgba(221,232,240,0.3)", marginTop: 2 }}>Choose when MailFlow runs your inbox digests.</p>
          </div>
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Schedule toggles */}
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(scheduleLabels).map(([key, { label, icon: Icon, time }]) => {
                const active = ((settings.digest_schedule as string[]) || ["morning", "afternoon", "evening"]).includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleScheduleTime(key)}
                    style={{
                      flex: 1, padding: "14px 12px", borderRadius: 10,
                      cursor: "pointer", fontFamily: "inherit",
                      textAlign: "center",
                      background: active ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.015)",
                      border: active
                        ? "1px solid rgba(0,212,255,0.12)"
                        : "1px solid rgba(255,255,255,0.04)",
                      color: active ? "#e8f4ff" : "rgba(221,232,240,0.25)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Icon size={16} style={{ marginBottom: 4, color: active ? "#00d4ff" : "rgba(221,232,240,0.15)", display: "block", margin: "0 auto 6px" }} />
                    <span style={{ display: "block", fontSize: 11.5, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 10, color: "rgba(221,232,240,0.2)", fontFamily: "monospace", marginTop: 2 }}>{time}</span>
                  </button>
                );
              })}
            </div>

            {/* Timezone */}
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "rgba(221,232,240,0.55)", marginBottom: 9 }}>
                <Globe size={11} style={{ marginRight: 4, display: "inline", verticalAlign: "middle" }} />
                Timezone
              </label>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowTimezone(!showTimezone)}
                  style={{
                    width: "100%", padding: "9px 14px", borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(221,232,240,0.45)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={11} style={{ opacity: 0.4 }} />
                    {(settings.timezone as string) || "UTC"}
                  </span>
                  <ChevronDown size={12} style={{ opacity: 0.3, transform: showTimezone ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                <AnimatePresence>
                  {showTimezone && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                        marginTop: 4, maxHeight: 180, overflowY: "auto",
                        background: "rgba(5,10,18,0.98)", border: "1px solid rgba(0,212,255,0.12)",
                        borderRadius: 8, backdropFilter: "blur(16px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      }}
                    >
                      {TIMEZONES.map(tz => (
                        <button
                          key={tz}
                          onClick={() => { setSettings(s => ({ ...s, timezone: tz })); setShowTimezone(false); }}
                          style={{
                            width: "100%", padding: "8px 14px", background: "none", border: "none",
                            cursor: "pointer", fontFamily: "inherit",
                            fontSize: 12.5, textAlign: "left",
                            color: (settings.timezone || "UTC") === tz ? "#00d4ff" : "rgba(221,232,240,0.4)",
                          }}
                        >
                          {tz}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section: Notification Channels ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          style={{
            borderRadius: 14, overflow: "hidden",
            background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#edf6ff", letterSpacing: "-0.01em" }}>Notification Channels</p>
            <p style={{ fontSize: 11.5, color: "rgba(221,232,240,0.3)", marginTop: 2 }}>Get digest summaries and approve replies via Telegram or Slack.</p>
          </div>
          <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Telegram */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <MessageCircle size={12} style={{ color: "#00d4ff", opacity: 0.5 }} />
                <label style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(221,232,240,0.55)" }}>
                  Telegram Chat ID
                </label>
              </div>
              <input
                type="text"
                value={(settings.telegram_chat_id as string) || ""}
                onChange={e => setSettings(s => ({ ...s, telegram_chat_id: e.target.value }))}
                placeholder="Message @userinfobot on Telegram to get your Chat ID"
                style={{
                  width: "100%", padding: "9px 14px", borderRadius: 8, outline: "none",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "#dde8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(0,212,255,0.3)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}
              />
            </div>

            {/* Slack */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <MessageCircle size={12} style={{ color: "#a78bfa", opacity: 0.5 }} />
                <label style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(221,232,240,0.55)" }}>
                  Slack Webhook URL
                </label>
                <span style={{ fontSize: 10, color: "rgba(221,232,240,0.15)", fontFamily: "monospace" }}>optional</span>
              </div>
              <input
                type="text"
                value={(settings.slack_webhook_url as string) || ""}
                onChange={e => setSettings(s => ({ ...s, slack_webhook_url: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                style={{
                  width: "100%", padding: "9px 14px", borderRadius: 8, outline: "none",
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "#dde8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={e => { e.target.style.borderColor = "rgba(0,212,255,0.3)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
          style={{
            borderRadius: 14, overflow: "hidden",
            background: "rgba(239,68,68,0.02)", border: "1px solid rgba(239,68,68,0.1)",
          }}
        >
          <div style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <AlertTriangle size={12} style={{ color: "rgba(239,68,68,0.5)" }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(239,68,68,0.6)", letterSpacing: "-0.01em" }}>
                Danger Zone
              </p>
            </div>
            <p style={{ fontSize: 11.5, color: "rgba(239,68,68,0.3)", marginTop: 2, marginBottom: 14 }}>
              Irreversible actions. Proceed with caution.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  if (confirm("Delete all your MailFlow data? This cannot be undone.")) {
                    /* Future: call delete endpoint */
                  }
                }}
                style={{
                  padding: "8px 16px", borderRadius: 7,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                  color: "rgba(239,68,68,0.6)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.background = "rgba(239,68,68,0.12)";
                  (e.target as HTMLElement).style.color = "rgba(239,68,68,0.8)";
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.background = "rgba(239,68,68,0.08)";
                  (e.target as HTMLElement).style.color = "rgba(239,68,68,0.6)";
                }}
              >
                Delete All Data
              </button>
              <button
                onClick={() => {
                  if (confirm("Disconnect all Gmail accounts?")) {
                    /* Future: call bulk disconnect */
                  }
                }}
                style={{
                  padding: "8px 16px", borderRadius: 7,
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.08)",
                  color: "rgba(239,68,68,0.4)", fontSize: 12, fontWeight: 500,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Disconnect All Accounts
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </Shell>
  );
}
