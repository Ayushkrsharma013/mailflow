"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ArrowRight, Check, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Connect" },
  { id: 3, label: "Channels" },
  { id: 4, label: "Done" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [stepLoaded, setStepLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [digestResult, setDigestResult] = useState<Record<string, unknown> | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function saveProgress(stepNum: number, completed = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("onboarding_progress")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("onboarding_progress")
        .update({ current_step: stepNum, completed, ...(completed ? { completed_at: new Date().toISOString() } : {}) })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("onboarding_progress")
        .insert({ user_id: user.id, current_step: stepNum, completed, ...(completed ? { completed_at: new Date().toISOString() } : {}) });
    }
  }

  async function handleSignup() {
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    await saveProgress(2);
    setStep(2);
    setLoading(false);
  }

  // On mount, resume from saved onboarding step (e.g. returning from OAuth callback)
  useEffect(() => {
    async function loadStep() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: progress } = await supabase
        .from("onboarding_progress")
        .select("current_step, completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (progress?.completed) {
        router.replace("/dashboard");
        return;
      }
      if (progress?.current_step) {
        setStep(progress.current_step);
      }
      setStepLoaded(true);
    }
    loadStep();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function checkGmail() {
    const res = await fetch("/mailflow/api/gmail/accounts");
    const data = await res.json();
    if (data.accounts?.length > 0) {
      setGmailConnected(true);
    }
  }

  useEffect(() => {
    if (step === 2) checkGmail();
  }, [step]);

  async function handleChannelsSubmit() {
    // Save settings
    await fetch("/mailflow/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_chat_id: telegramChatId || null,
        slack_webhook_url: slackWebhook || null,
      }),
    });
    await saveProgress(4);
    setStep(4);
    // Run first digest
    setLoading(true);
    try {
      const res = await fetch("/mailflow/api/digest/run", { method: "POST" });
      const data = await res.json();
      setDigestResult(data);
    } catch { /* ok */ }
    setLoading(false);
  }

  async function finish() {
    await saveProgress(4, true);
    router.push("/dashboard");
  }

  function StepIndicator() {
    return (
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        {STEPS.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: step === s.id ? "#00d4ff" : step > s.id ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.1)",
              boxShadow: step === s.id ? "0 0 8px rgba(0,212,255,0.4)" : "none",
              transition: "all 0.3s ease",
            }} />
            {s.id < STEPS.length && (
              <div style={{ width: 20, height: 1, background: step > s.id ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)" }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Wait for saved progress to load before rendering to avoid flashing step 1
  if (!stepLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: "#000000" }} />
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#000000", fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative", zIndex: 1,
          width: "100%", maxWidth: 440,
          padding: "36px 32px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(0,212,255,0.13)",
          boxShadow: "0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.06) inset",
        }}
      >
        {/* Top glow */}
        <div style={{
          position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)",
        }} />

        <StepIndicator />

        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12, margin: "0 auto 16px",
                  background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,136,204,0.1))",
                  border: "1px solid rgba(0,212,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Mail size={22} style={{ color: "#00d4ff" }} />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em", marginBottom: 8 }}>
                  Your inbox, organized by AI
                </h1>
                <p style={{ fontSize: 13, color: "rgba(221,232,240,0.45)", lineHeight: 1.6 }}>
                  MailFlow categorizes every email, drafts replies in your voice, and sends digests to your chat apps.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 9, outline: "none",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
                    color: "#dde8f0", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <input type="password" placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 9, outline: "none",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
                    color: "#dde8f0", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                {error && (
                  <p style={{ fontSize: 12, color: "#fca5a5", padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>{error}</p>
                )}
                <button onClick={handleSignup} disabled={loading || !email || !password}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 9, border: "none",
                    background: loading || !email || !password ? "rgba(0,212,255,0.1)" : "linear-gradient(135deg, #00b4db, #0083b0)",
                    color: loading || !email || !password ? "rgba(0,212,255,0.4)" : "#fff",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: loading || !email || !password ? "none" : "0 0 20px rgba(0,212,255,0.2)",
                  }}
                >
                  {loading ? "Creating account..." : <>Get Started <ArrowRight size={14} /></>}
                </button>
                <button onClick={async () => { await saveProgress(2); setStep(2); }}
                  style={{
                    background: "none", border: "none", color: "rgba(221,232,240,0.25)", fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                  }}
                >
                  I already have an account — skip
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Connect Gmail */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#edf6ff", marginBottom: 8 }}>Connect your Gmail</h2>
                <p style={{ fontSize: 13, color: "rgba(221,232,240,0.45)", lineHeight: 1.6 }}>
                  OAuth 2.0 — we never see your password. Connect one or more accounts.
                </p>
              </div>

              {gmailConnected ? (
                <div style={{
                  padding: "14px 18px", borderRadius: 10, marginBottom: 16,
                  background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Check size={16} style={{ color: "#00ff88" }} />
                  <span style={{ fontSize: 13, color: "rgba(0,255,136,0.7)" }}>Gmail account connected!</span>
                </div>
              ) : (
                <a href="/mailflow/api/auth/google"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", padding: "12px", borderRadius: 9,
                    background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(0,212,255,0.2)",
                    color: "rgba(0,212,255,0.7)", fontSize: 13, fontWeight: 500,
                    textDecoration: "none", fontFamily: "inherit", marginBottom: 16, cursor: "pointer",
                  }}
                >
                  + Connect Gmail Account
                </a>
              )}

              <button onClick={async () => { await saveProgress(3); setStep(3); }}
                style={{
                  width: "100%", padding: "11px", borderRadius: 9, border: "none",
                  background: "linear-gradient(135deg, #00b4db, #0083b0)",
                  color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* Step 3: Channels */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <MessageCircle size={28} style={{ color: "#00d4ff", marginBottom: 12 }} />
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#edf6ff", marginBottom: 8 }}>Notification channels</h2>
                <p style={{ fontSize: 13, color: "rgba(221,232,240,0.45)", lineHeight: 1.6 }}>
                  Get digests and approve replies via Telegram or Slack.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(221,232,240,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 6, display: "block" }}>
                    Telegram Chat ID
                  </label>
                  <input type="text" value={telegramChatId}
                    onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="Message @userinfobot on Telegram"
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8, outline: "none",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.1)",
                      color: "#dde8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(221,232,240,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", marginBottom: 6, display: "block" }}>
                    Slack Webhook URL (optional)
                  </label>
                  <input type="text" value={slackWebhook}
                    onChange={e => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8, outline: "none",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.1)",
                      color: "#dde8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
                <button onClick={handleChannelsSubmit} disabled={loading}
                  style={{
                    width: "100%", padding: "11px", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #00b4db, #0083b0)",
                    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", boxShadow: "0 0 16px rgba(0,212,255,0.2)",
                  }}
                >
                  {loading ? "Running first digest..." : "Finish Setup"}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
                  background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={26} style={{ color: "#00ff88" }} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: "#edf6ff", marginBottom: 8 }}>
                  You&apos;re all set!
                </h2>
                <p style={{ fontSize: 13, color: "rgba(221,232,240,0.45)", lineHeight: 1.6, marginBottom: 24 }}>
                  Your AI inbox assistant is ready. We&apos;ll run digests automatically and notify you via your chosen channels.
                </p>

                <button onClick={finish}
                  style={{
                    padding: "12px 32px", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #00b4db, #0083b0)",
                    color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: "0 0 24px rgba(0,212,255,0.25)",
                    display: "inline-flex", alignItems: "center", gap: 8,
                  }}
                >
                  Go to Dashboard <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
