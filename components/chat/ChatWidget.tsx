"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Plus, Minus, Send, Sparkles, Bot } from "lucide-react";
import type { ChatToolCall } from "@/lib/types";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string | null;
  toolCalls: ChatToolCall[] | null;
}

interface ChatWidgetProps {
  contextLabel?: string;
}

export default function ChatWidget({ contextLabel }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, loading, scrollToBottom]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setMinimized(false); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const msgText = text.trim();
    setInput("");
    setError("");

    const userMsg: UIMessage = { id: crypto.randomUUID(), role: "user", content: msgText, toolCalls: null };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/mailflow/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText, conversationId }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setConversationId(data.conversationId);
        const aiMessages: UIMessage[] = (data.messages || []).map(
          (m: { role: string; content: string | null; toolCalls: ChatToolCall[] | null }) => ({
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: m.content,
            toolCalls: m.toolCalls,
          })
        );
        setMessages(prev => [...prev, ...aiMessages]);
      }
    } catch {
      setError("Failed to reach AI. Check your connection.");
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const suggestions = [
    { label: "Summarize my inbox", icon: "↓" },
    { label: "Check for urgent emails", icon: "•" },
    { label: "Draft replies for all action items", icon: "✎" },
  ];

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              width: 48, height: 48, borderRadius: "50%",
              background: "linear-gradient(135deg, #00b4db, #0083b0)",
              border: "none", cursor: "pointer",
              boxShadow: "0 0 24px rgba(0,212,255,0.35), 0 4px 16px rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <div style={{
              position: "absolute", inset: -4, borderRadius: "50%",
              border: "1.5px solid rgba(0,212,255,0.2)",
              animation: "mailflow-pulse 2s ease-out infinite",
            }} />
            <MessageCircle size={20} style={{ color: "#020a14", position: "relative", zIndex: 1 }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={minimized
              ? { opacity: 0, y: 20, scale: 0.95, height: 0 }
              : { opacity: 1, y: 0, scale: 1, height: "auto" }
            }
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 100,
              width: 380, maxHeight: minimized ? 0 : 520,
              borderRadius: 16,
              background: "rgba(10,15,26,0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0,212,255,0.12)",
              boxShadow: "0 0 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.05) inset",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
              fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(0,212,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,136,204,0.1))",
                  border: "1px solid rgba(0,212,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bot size={12} style={{ color: "#00d4ff" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e8f4ff" }}>MailFlow AI</span>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: loading ? "#f97316" : "#00ff88",
                  boxShadow: loading
                    ? "0 0 6px rgba(249,115,22,0.4)"
                    : "0 0 6px rgba(0,255,136,0.4)",
                }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => { setConversationId(null); setMessages([]); }}
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  title="New chat"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setMinimized(!minimized)}
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => { setOpen(false); setMinimized(false); }}
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Context Pill */}
                {contextLabel && (
                  <div style={{ padding: "6px 16px", flexShrink: 0 }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 10px", borderRadius: 99,
                      background: "rgba(0,212,255,0.06)",
                      border: "1px solid rgba(0,212,255,0.12)",
                      fontSize: 10, color: "rgba(0,212,255,0.55)",
                      fontFamily: "monospace",
                    }}>
                      <Sparkles size={10} style={{ color: "#00d4ff", opacity: 0.6 }} />
                      {contextLabel}
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "8px 14px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  {/* Empty State */}
                  {messages.length === 0 && (
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      padding: "20px 10px",
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, marginBottom: 12,
                        background: "rgba(0,212,255,0.06)",
                        border: "1px solid rgba(0,212,255,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bot size={22} style={{ color: "rgba(0,212,255,0.35)" }} />
                      </div>
                      <p style={{
                        fontSize: 13, fontWeight: 600,
                        color: "rgba(221,232,240,0.45)", marginBottom: 4,
                      }}>
                        Inbox Assistant
                      </p>
                      <p style={{
                        fontSize: 10, color: "rgba(221,232,240,0.2)",
                        textAlign: "center", lineHeight: 1.5, marginBottom: 14,
                      }}>
                        Ask me to summarize, draft replies,<br />or manage your inbox.
                      </p>
                      {suggestions.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => sendMessage(s.label)}
                          style={{
                            textAlign: "left", width: "100%",
                            padding: "8px 11px", borderRadius: 7, marginBottom: 5,
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            color: "rgba(221,232,240,0.4)", fontSize: 11,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                          onMouseEnter={e => {
                            (e.target as HTMLElement).style.background = "rgba(0,212,255,0.04)";
                          }}
                          onMouseLeave={e => {
                            (e.target as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                          }}
                        >
                          <span style={{ color: "#00d4ff", marginRight: 5 }}>{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      {/* User message */}
                      {msg.role === "user" && (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <div style={{
                            maxWidth: 260, padding: "8px 12px",
                            borderRadius: "10px 10px 2px 10px",
                            background: "rgba(0,212,255,0.1)",
                            border: "1px solid rgba(0,212,255,0.12)",
                          }}>
                            <p style={{
                              fontSize: 12, color: "#dde8f0",
                              lineHeight: 1.5, margin: 0,
                            }}>
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* AI message */}
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 5,
                            flexShrink: 0, marginTop: 2,
                            background: "rgba(0,212,255,0.08)",
                            border: "1px solid rgba(0,212,255,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Bot size={10} style={{ color: "#00d4ff" }} />
                          </div>
                          <div style={{ maxWidth: 280 }}>
                            {msg.content && (
                              <div style={{
                                padding: "8px 11px",
                                borderRadius: "10px 10px 10px 2px",
                                background: "rgba(255,255,255,0.025)",
                                border: "1px solid rgba(255,255,255,0.05)",
                              }}>
                                <p style={{
                                  fontSize: 11.5, color: "rgba(221,232,240,0.65)",
                                  lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap",
                                }}>
                                  {msg.content}
                                </p>
                              </div>
                            )}

                            {/* Tool call cards */}
                            {msg.toolCalls?.map((tc, ti) => (
                              <div key={ti} style={{
                                marginTop: 5, padding: "7px 10px", borderRadius: 7,
                                background: "rgba(0,212,255,0.03)",
                                border: "1px solid rgba(0,212,255,0.08)",
                              }}>
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  marginBottom: tc.result ? 4 : 0,
                                }}>
                                  <Sparkles size={9} style={{ color: "#00d4ff" }} />
                                  <span style={{
                                    fontSize: 9.5, fontWeight: 600,
                                    fontFamily: "monospace", color: "#00d4ff",
                                  }}>
                                    {tc.name}
                                  </span>
                                  <span style={{
                                    fontSize: 8, marginLeft: "auto",
                                    color: tc.status === "done"
                                      ? "rgba(0,255,136,0.5)"
                                      : tc.status === "error"
                                        ? "rgba(239,68,68,0.5)"
                                        : "rgba(249,115,22,0.5)",
                                  }}>
                                    {tc.status}
                                  </span>
                                </div>
                                {tc.result != null && (
                                  <div style={{
                                    fontSize: 10, color: "rgba(221,232,240,0.35)",
                                    background: "rgba(0,0,0,0.2)", borderRadius: 5,
                                    padding: "5px 8px", maxHeight: 100, overflowY: "auto",
                                    fontFamily: "monospace", lineHeight: 1.4,
                                  }}>
                                    {typeof tc.result === "string"
                                      ? tc.result
                                      : JSON.stringify(tc.result, null, 1)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Thinking indicator */}
                  {loading && (
                    <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                        background: "rgba(0,212,255,0.08)",
                        border: "1px solid rgba(0,212,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bot size={10} style={{ color: "#00d4ff" }} />
                      </div>
                      <div style={{
                        padding: "8px 14px",
                        borderRadius: "10px 10px 10px 2px",
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        display: "flex", gap: 4, alignItems: "center",
                      }}>
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -6, 0], opacity: [0.3, 0.9, 0.3] }}
                            transition={{
                              duration: 1.4, repeat: Infinity, delay,
                              ease: "easeInOut",
                            }}
                            style={{
                              width: 5, height: 5, borderRadius: "50%",
                              background: "rgba(0,212,255,0.5)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.15)",
                    }}>
                      <p style={{ fontSize: 11, color: "#fca5a5", margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                  padding: "8px 14px",
                  borderTop: "1px solid rgba(0,212,255,0.06)",
                  flexShrink: 0,
                }}>
                  <div style={{
                    display: "flex", alignItems: "flex-end", gap: 6,
                    padding: "7px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(0,212,255,0.08)",
                  }}>
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={loading ? "AI is thinking..." : "Ask about your inbox..."}
                      rows={1}
                      disabled={loading}
                      style={{
                        flex: 1, background: "none", border: "none", outline: "none",
                        color: "#dde8f0", fontSize: 12, fontFamily: "inherit",
                        resize: "none", lineHeight: 1.5,
                      }}
                    />
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={loading || !input.trim()}
                      style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        border: "none",
                        cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                        background: input.trim()
                          ? "rgba(0,212,255,0.15)"
                          : "rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Send size={11} style={{
                        color: input.trim()
                          ? "#00d4ff"
                          : "rgba(221,232,240,0.2)",
                      }} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse animation keyframes */}
      <style jsx global>{`
        @keyframes mailflow-pulse {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </>
  );
}
