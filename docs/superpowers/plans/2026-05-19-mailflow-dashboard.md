# MailFlow Productized Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform MailFlow into a full productized SaaS dashboard with floating AI chat widget, minimalist UI, onboarding wizard, pricing landing page, and bidirectional Telegram sync.

**Architecture:** Floating chat widget (Gemini 2.5 Flash with tool calling) overlays the dashboard. Chat messages persist in Supabase. Onboarding wizard gates first-time users via middleware. Landing page gets 3-tier pricing. Telegram actions sync bidirectionally via Supabase Realtime + message edits.

**Tech Stack:** Next.js 16.2, Tailwind CSS 4, TypeScript, Supabase (shared `mark1-flowforges`), Gemini 2.5 Flash, framer-motion, lucide-react. Inline styles pattern (no CSS modules).

---

## Phase 1 — Chat Widget Core

### Task 1: Create database tables via Supabase migration

**Files:**
- Migrate: Supabase project `otxifqcvgmxoxemmgbjd` — apply migrations via MCP

- [ ] **Step 1: Create `chat_conversations` table**

Use `mcp__plugin_supabase_supabase__apply_migration`:
```sql
create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

alter table chat_conversations enable row level security;

create policy "Users can manage own conversations"
  on chat_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Create `chat_messages` table**

Use `mcp__plugin_supabase_supabase__apply_migration`:
```sql
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "Users can manage messages in own conversations"
  on chat_messages for all
  using (
    exists (
      select 1 from chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
      and chat_conversations.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from chat_conversations
      where chat_conversations.id = chat_messages.conversation_id
      and chat_conversations.user_id = auth.uid()
    )
  );

create index idx_chat_messages_conversation on chat_messages(conversation_id, created_at);
```

- [ ] **Step 3: Create `onboarding_progress` table**

Use `mcp__plugin_supabase_supabase__apply_migration`:
```sql
create table if not exists onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_step int not null default 1,
  completed bool not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table onboarding_progress enable row level security;

create policy "Users can manage own onboarding progress"
  on onboarding_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 4: Enable Realtime on `mailflow_actions`**

Use `mcp__plugin_supabase_supabase__apply_migration`:
```sql
alter publication supabase_realtime add table mailflow_actions;
```

---

### Task 2: Add chat types and Gemini chat logic

**Files:**
- Modify: `lib/types.ts` — add chat types at bottom
- Create: `lib/chat.ts` — Gemini tool calling, tool execution

- [ ] **Step 1: Add chat types to `lib/types.ts`**

Append to `lib/types.ts`:
```typescript
export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: ChatToolCall[] | null;
  created_at: string;
}

export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'done' | 'error';
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create `lib/chat.ts` — tool definitions and Gemini interaction**

Create `lib/chat.ts`:
```typescript
import type { ChatMessage, ChatToolCall } from "@/lib/types";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are MailFlow AI, an expert email assistant. You help users manage their Gmail inbox through natural conversation.

You have access to tools that let you:
- Summarize the user's inbox (get_inbox_summary)
- Get details about specific emails (get_email_details)
- Draft AI replies (draft_reply)
- Approve and send drafted replies (approve_action)
- Reject drafted replies (reject_action)
- Archive emails (archive_email)
- Run a fresh inbox scan (run_digest)

Rules:
- Be concise and helpful. Show the user what you're doing via tool calls.
- When the user asks to summarize or check inbox, use get_inbox_summary first.
- When drafting replies, always show the draft and ask for approval — never send without asking.
- Present information in a scannable way. Use bullets for lists.
- If a tool returns an error, tell the user plainly what went wrong.`;

const TOOL_DECLARATIONS = [
  {
    name: "get_inbox_summary",
    description: "Get a summary of the current inbox digest including category counts and a text summary",
  },
  {
    name: "get_email_details",
    description: "Get full details of specific emails — pass emailId for one, or search to find by sender/subject",
    parameters: {
      type: "object" as const,
      properties: {
        emailId: { type: "string", description: "Optional: get a specific email by its ID" },
        search: { type: "string", description: "Optional: search by sender name or subject keyword" },
        category: { type: "string", description: "Optional: filter by category (urgent, action_needed, fyi, promotion, spam)" },
        limit: { type: "number", description: "Optional: max results (default 5)" },
      },
    },
  },
  {
    name: "draft_reply",
    description: "Generate an AI-drafted reply for a specific email. Returns the draft for user approval.",
    parameters: {
      type: "object" as const,
      properties: {
        emailId: { type: "string", description: "The email ID to draft a reply for" },
      },
      required: ["emailId"],
    },
  },
  {
    name: "approve_action",
    description: "Approve and send a drafted reply. The action will be executed immediately.",
    parameters: {
      type: "object" as const,
      properties: {
        actionId: { type: "string", description: "The action ID to approve" },
      },
      required: ["actionId"],
    },
  },
  {
    name: "reject_action",
    description: "Reject/discard a drafted reply without sending it",
    parameters: {
      type: "object" as const,
      properties: {
        actionId: { type: "string", description: "The action ID to reject" },
      },
      required: ["actionId"],
    },
  },
  {
    name: "archive_email",
    description: "Archive one or more emails by ID",
    parameters: {
      type: "object" as const,
      properties: {
        emailIds: { type: "array", items: { type: "string" }, description: "Array of email IDs to archive" },
        category: { type: "string", description: "Alternatively, archive all emails in a category (promotion, spam, fyi)" },
      },
    },
  },
  {
    name: "run_digest",
    description: "Run a fresh inbox scan and digest now",
  },
];

function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> | undefined;
  if (!candidates?.length) return "";
  const parts = candidates[0]?.content?.parts || [];
  const textPart = parts.find(p => !p.thought);
  return textPart?.text || parts[0]?.text || "";
}

function extractGeminiFunctionCall(data: Record<string, unknown>): { name: string; args: Record<string, unknown> } | null {
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ functionCall?: { name: string; args: Record<string, unknown> } }> } }> | undefined;
  if (!candidates?.length) return null;
  const parts = candidates[0]?.content?.parts || [];
  const fc = parts.find(p => p.functionCall)?.functionCall;
  return fc || null;
}

export interface ToolContext {
  userId: string;
  digestId?: string | null;
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  switch (name) {
    case "get_inbox_summary": {
      const { data: digest } = await supabase
        .from("digests")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!digest) return { error: "No digest found. Try running one first." };

      const categories = (digest.categories as Record<string, number>) || {};
      const total = Object.values(categories).reduce((s: number, n: number) => s + n, 0);

      const { count: urgentCount } = await supabase
        .from("digest_emails")
        .select("*", { count: "exact", head: true })
        .eq("digest_id", digest.id)
        .eq("category", "urgent");

      const { count: actionCount } = await supabase
        .from("digest_emails")
        .select("*", { count: "exact", head: true })
        .eq("digest_id", digest.id)
        .eq("category", "action_needed");

      const { count: pendingCount } = await supabase
        .from("mailflow_actions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("status", "pending");

      return {
        digestId: digest.id,
        total,
        categories,
        summary: digest.summary,
        urgentCount: urgentCount || 0,
        actionCount: actionCount || 0,
        pendingActions: pendingCount || 0,
        createdAt: digest.created_at,
      };
    }

    case "get_email_details": {
      let query = supabase.from("digest_emails").select("*").eq("user_id", ctx.userId).order("created_at", { ascending: false });

      if (args.emailId) {
        query = query.eq("id", args.emailId);
      }
      if (args.category) {
        query = query.eq("category", args.category);
      }
      if (args.search) {
        const term = `%${args.search}%`;
        query = query.or(`from_name.ilike.${term},from_email.ilike.${term},subject.ilike.${term}`);
      }

      const limit = (args.limit as number) || 5;
      const { data: emails } = await query.limit(limit);

      return {
        emails: (emails || []).map((e: Record<string, unknown>) => ({
          id: e.id,
          fromName: e.from_name,
          fromEmail: e.from_email,
          subject: e.subject,
          snippet: e.snippet,
          category: e.category,
          aiSummary: e.ai_summary,
          aiSuggestedAction: e.ai_suggested_action,
          aiDraftReply: e.ai_draft_reply,
        })),
        total: emails?.length || 0,
      };
    }

    case "draft_reply": {
      const { data: email } = await supabase
        .from("digest_emails")
        .select("*")
        .eq("id", args.emailId)
        .eq("user_id", ctx.userId)
        .single();

      if (!email) return { error: "Email not found" };

      if (email.ai_draft_reply) {
        const { data: actions } = await supabase
          .from("mailflow_actions")
          .select("*")
          .eq("digest_email_id", email.id)
          .eq("status", "pending");

        return {
          emailId: email.id,
          subject: email.subject,
          fromName: email.from_name,
          draftReply: email.ai_draft_reply,
          pendingActionId: actions?.length ? (actions[0] as Record<string, unknown>).id : null,
        };
      }

      const { categorizeEmails, draftReplyWithTone } = await import("@/lib/categorize");
      const { fetchUnreadMessages } = await import("@/lib/gmail");
      const { data: accounts } = await supabase.from("gmail_accounts").select("*").eq("user_id", ctx.userId).eq("is_active", true);
      if (!accounts?.length) return { error: "No active Gmail accounts" };

      const account = accounts[0] as Record<string, unknown>;
      const draft = await draftReplyWithTone(
        { id: email.gmail_message_id, from: `${email.from_name} <${email.from_email}>`, subject: email.subject, snippet: email.snippet, bodyText: email.body_text || "", fromName: email.from_name, fromEmail: email.from_email, threadId: email.thread_id, receivedAt: email.created_at },
        []
      );

      await supabase.from("digest_emails").update({ ai_draft_reply: draft }).eq("id", email.id);

      return {
        emailId: email.id,
        subject: email.subject,
        fromName: email.from_name,
        draftReply: draft,
        pendingActionId: null,
      };
    }

    case "approve_action": {
      const { data: action } = await supabase.from("mailflow_actions").select("*").eq("id", args.actionId).eq("user_id", ctx.userId).single();
      if (!action) return { error: "Action not found" };

      await supabase.from("mailflow_actions").update({ status: "approved", approved_by: "web", resolved_at: new Date().toISOString() }).eq("id", args.actionId);

      const { executeAction } = await import("@/lib/actions");
      const result = await executeAction(action as Parameters<typeof executeAction>[0]);
      return { success: result.success, error: result.error };
    }

    case "reject_action": {
      const { data: action } = await supabase.from("mailflow_actions").select("*").eq("id", args.actionId).eq("user_id", ctx.userId).single();
      if (!action) return { error: "Action not found" };

      await supabase.from("mailflow_actions").update({ status: "rejected", approved_by: "web", resolved_at: new Date().toISOString() }).eq("id", args.actionId);
      return { success: true };
    }

    case "archive_email": {
      if (args.category) {
        const { data: emails } = await supabase.from("digest_emails").select("id, gmail_message_id, account_id").eq("user_id", ctx.userId).eq("category", args.category);
        if (!emails?.length) return { archived: 0 };

        for (const e of emails as Record<string, unknown>[]) {
          const { data: account } = await supabase.from("gmail_accounts").select("*").eq("id", e.account_id).single();
          if (account) {
            const { archiveMessage } = await import("@/lib/gmail");
            archiveMessage(account as Parameters<typeof archiveMessage>[0], e.gmail_message_id as string).catch(() => {});
          }
        }
        return { archived: emails.length, category: args.category };
      }

      if (Array.isArray(args.emailIds)) {
        let count = 0;
        for (const emailId of args.emailIds as string[]) {
          const { data: email } = await supabase.from("digest_emails").select("id, gmail_message_id, account_id").eq("id", emailId).eq("user_id", ctx.userId).single();
          if (email) {
            const { data: account } = await supabase.from("gmail_accounts").select("*").eq("id", (email as Record<string, unknown>).account_id).single();
            if (account) {
              const { archiveMessage } = await import("@/lib/gmail");
              archiveMessage(account as Parameters<typeof archiveMessage>[0], (email as Record<string, unknown>).gmail_message_id as string).catch(() => {});
              count++;
            }
          }
        }
        return { archived: count };
      }

      return { error: "Provide emailIds array or category to archive" };
    }

    case "run_digest": {
      const { runDigestForUser } = await import("@/lib/digest");
      const result = await runDigestForUser(ctx.userId);
      return {
        success: !result.error,
        digestId: result.digestId,
        error: result.error,
        totalEmails: result.notification?.totalEmails || 0,
        urgentCount: result.notification?.urgentCount || 0,
        actionCount: result.notification?.actionCount || 0,
        summary: result.notification?.summary || "",
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function sendMessageToGemini(
  messages: { role: "user" | "assistant"; content: string; toolCalls?: ChatToolCall[] }[],
  userId: string
): Promise<{ text: string | null; toolCall: { name: string; args: Record<string, unknown> } | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const contents = messages.map(m => {
    const parts: Array<Record<string, unknown>> = [];
    if (m.content) {
      parts.push({ text: m.content });
    }
    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        if (tc.result) {
          parts.push({
            functionResponse: {
              name: tc.name,
              response: { result: tc.result },
            },
          });
        }
      }
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts: parts.length > 0 ? parts : [{ text: "" }],
    };
  });

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  };

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as Record<string, unknown>;
  const text = extractGeminiText(data);
  const functionCall = extractGeminiFunctionCall(data);

  return { text: text || null, toolCall: functionCall };
}
```

---

### Task 3: Create chat API routes

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `app/api/chat/history/route.ts`

- [ ] **Step 1: Create `app/api/chat/route.ts`**

Create `app/api/chat/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendMessageToGemini, executeToolCall, type ToolContext } from "@/lib/chat";
import type { ChatToolCall } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { message: string; conversationId?: string };
    const userMessage = body.message?.trim();
    if (!userMessage) return NextResponse.json({ error: "Message required" }, { status: 400 });

    // Get or create conversation
    let conversationId = body.conversationId;
    if (conversationId) {
      const { data: existing } = await supabase.from("chat_conversations").select("id").eq("id", conversationId).eq("user_id", user.id).maybeSingle();
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      const title = userMessage.slice(0, 80) + (userMessage.length > 80 ? "..." : "");
      const { data: conv } = await supabase.from("chat_conversations").insert({ user_id: user.id, title }).select().single();
      if (!conv) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      conversationId = conv.id;
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // Load history for Gemini context
    const { data: history } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messageHistory = (history || []).map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content || "",
      toolCalls: (m.tool_calls as ChatToolCall[] | null) || undefined,
    }));

    // Tool calling loop (max 5 iterations)
    const ctx: ToolContext = { userId: user.id };
    let iterations = 0;
    const maxIterations = 5;
    const responseMessages: Array<{ role: string; content: string | null; toolCalls: ChatToolCall[] | null }> = [];

    while (iterations < maxIterations) {
      iterations++;
      const { text, toolCall } = await sendMessageToGemini(messageHistory, user.id);

      if (toolCall) {
        messageHistory.push({ role: "assistant", content: text || "", toolCalls: [{ name: toolCall.name, args: toolCall.args, status: "pending" }] });

        let toolResult: unknown;
        let toolStatus: "done" | "error" = "done";
        try {
          toolResult = await executeToolCall(toolCall.name, toolCall.args, ctx);
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : "Tool error" };
          toolStatus = "error";
        }

        const toolCallRecord: ChatToolCall = { name: toolCall.name, args: toolCall.args, result: toolResult, status: toolStatus };
        responseMessages.push({ role: "assistant", content: text, toolCalls: [toolCallRecord] });

        // Save assistant message with tool call
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          tool_calls: JSON.parse(JSON.stringify([toolCallRecord])),
        });

        messageHistory.push({
          role: "user",
          content: "",
          toolCalls: [{ name: toolCall.name, args: toolCall.args, result: toolResult, status: toolStatus }],
        });
      } else {
        responseMessages.push({ role: "assistant", content: text, toolCalls: null });

        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          tool_calls: null,
        });
        break;
      }
    }

    return NextResponse.json({
      conversationId,
      messages: responseMessages,
    });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/chat/history/route.ts`**

Create `app/api/chat/history/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      return NextResponse.json({ messages });
    }

    const { data: conversations } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[chat history]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const conversationId = url.searchParams.get("conversationId");

    if (conversationId) {
      await supabase.from("chat_messages").delete().eq("conversation_id", conversationId);
      await supabase.from("chat_conversations").delete().eq("id", conversationId).eq("user_id", user.id);
      return NextResponse.json({ ok: true });
    }

    // Delete all conversations for user
    const { data: convs } = await supabase.from("chat_conversations").select("id").eq("user_id", user.id);
    if (convs?.length) {
      const ids = convs.map(c => c.id);
      await supabase.from("chat_messages").delete().in("conversation_id", ids);
      await supabase.from("chat_conversations").delete().eq("user_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chat history delete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

---

### Task 4: Create ChatWidget component

**Files:**
- Create: `components/chat/ChatWidget.tsx`

- [ ] **Step 1: Create `components/chat/ChatWidget.tsx`**

Create `components/chat/ChatWidget.tsx`:
```typescript
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        const aiMessages: UIMessage[] = (data.messages || []).map((m: { role: string; content: string | null; toolCalls: ChatToolCall[] | null }, i: number) => ({
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: m.content,
          toolCalls: m.toolCalls,
        }));
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
            {/* Pulse ring */}
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
            animate={minimized ? { opacity: 0, y: 20, scale: 0.95, height: 0 } : { opacity: 1, y: 0, scale: 1, height: "auto" }}
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
                  boxShadow: loading ? "0 0 6px rgba(249,115,22,0.4)" : "0 0 6px rgba(0,255,136,0.4)",
                }} />
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => {
                    setConversationId(null);
                    setMessages([]);
                  }}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, lineHeight: 1,
                  }}
                  title="New chat"
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setMinimized(!minimized)}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => { setOpen(false); setMinimized(false); }}
                  style={{
                    width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
                    background: "none", color: "rgba(221,232,240,0.35)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
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
                      fontSize: 10, color: "rgba(0,212,255,0.55)", fontFamily: "monospace",
                    }}>
                      <Sparkles size={10} style={{ color: "#00d4ff", opacity: 0.6 }} />
                      {contextLabel}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "8px 14px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  {messages.length === 0 && (
                    <div style={{
                      flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", padding: "20px 10px",
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, marginBottom: 12,
                        background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bot size={22} style={{ color: "rgba(0,212,255,0.35)" }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(221,232,240,0.45)", marginBottom: 4 }}>
                        Inbox Assistant
                      </p>
                      <p style={{ fontSize: 10, color: "rgba(221,232,240,0.2)", textAlign: "center", lineHeight: 1.5, marginBottom: 14 }}>
                        Ask me to summarize, draft replies,<br />or manage your inbox.
                      </p>
                      {suggestions.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => sendMessage(s.label)}
                          style={{
                            textAlign: "left", width: "100%", padding: "8px 11px",
                            borderRadius: 7, marginBottom: 5,
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            color: "rgba(221,232,240,0.4)", fontSize: 11,
                            cursor: "pointer", fontFamily: "inherit",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.background = "rgba(0,212,255,0.04)"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                        >
                          <span style={{ color: "#00d4ff", marginRight: 5 }}>{s.icon}</span> {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div key={msg.id}>
                      {/* User message */}
                      {msg.role === "user" && (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <div style={{
                            maxWidth: 260, padding: "8px 12px",
                            borderRadius: "10px 10px 2px 10px",
                            background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.12)",
                          }}>
                            <p style={{ fontSize: 12, color: "#dde8f0", lineHeight: 1.5, margin: 0 }}>{msg.content}</p>
                          </div>
                        </div>
                      )}

                      {/* AI message */}
                      {msg.role === "assistant" && (
                        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 5, flexShrink: 0, marginTop: 2,
                            background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Bot size={10} style={{ color: "#00d4ff" }} />
                          </div>
                          <div style={{ maxWidth: 280 }}>
                            {msg.content && (
                              <div style={{
                                padding: "8px 11px", borderRadius: "10px 10px 10px 2px",
                                background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                              }}>
                                <p style={{ fontSize: 11.5, color: "rgba(221,232,240,0.65)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                              </div>
                            )}

                            {/* Tool call cards */}
                            {msg.toolCalls?.map((tc, ti) => (
                              <div key={ti} style={{
                                marginTop: 5, padding: "7px 10px", borderRadius: 7,
                                background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: tc.result ? 4 : 0 }}>
                                  <Sparkles size={9} style={{ color: "#00d4ff" }} />
                                  <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: "monospace", color: "#00d4ff" }}>
                                    {tc.name}
                                  </span>
                                  <span style={{
                                    fontSize: 8, marginLeft: "auto",
                                    color: tc.status === "done" ? "rgba(0,255,136,0.5)" : tc.status === "error" ? "rgba(239,68,68,0.5)" : "rgba(249,115,22,0.5)",
                                  }}>
                                    {tc.status}
                                  </span>
                                </div>
                                {tc.result && (
                                  <div style={{
                                    fontSize: 10, color: "rgba(221,232,240,0.35)",
                                    background: "rgba(0,0,0,0.2)", borderRadius: 5,
                                    padding: "5px 8px", maxHeight: 100, overflowY: "auto",
                                    fontFamily: "monospace", lineHeight: 1.4,
                                  }}>
                                    {typeof tc.result === "string" ? tc.result : JSON.stringify(tc.result, null, 1)}
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
                        background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bot size={10} style={{ color: "#00d4ff" }} />
                      </div>
                      <div style={{
                        padding: "8px 14px", borderRadius: "10px 10px 10px 2px",
                        background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
                        display: "flex", gap: 4, alignItems: "center",
                      }}>
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -6, 0], opacity: [0.3, 0.9, 0.3] }}
                            transition={{ duration: 1.4, repeat: Infinity, delay, ease: "easeInOut" }}
                            style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(0,212,255,0.5)" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{
                      padding: "8px 12px", borderRadius: 8,
                      background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                    }}>
                      <p style={{ fontSize: 11, color: "#fca5a5", margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(0,212,255,0.06)", flexShrink: 0 }}>
                  <div style={{
                    display: "flex", alignItems: "flex-end", gap: 6,
                    padding: "7px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(0,212,255,0.08)",
                  }}>
                    <textarea
                      ref={inputRef}
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
                        placeholderColor: "rgba(221,232,240,0.2)",
                      }}
                    />
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={loading || !input.trim()}
                      style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                        background: input.trim() ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "background 0.15s",
                      }}
                    >
                      <Send size={11} style={{ color: input.trim() ? "#00d4ff" : "rgba(221,232,240,0.2)" }} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulse animation style */}
      <style jsx global>{`
        @keyframes mailflow-pulse {
          0% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </>
  );
}
```

---

### Task 5: Integrate ChatWidget into dashboard

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add ChatWidget import and render to dashboard**

In `app/dashboard/page.tsx`, add:
```typescript
import ChatWidget from "@/components/chat/ChatWidget";
```

At the top of the file with other imports (line 10 area). Then add the ChatWidget component inside the Shell, just before the closing `</Shell>` tag (around line 206):

```typescript
      <ChatWidget contextLabel={data?.digest ? `Today's Digest · ${data.emails?.length || 0} emails` : undefined} />
```

Add it right after the `</motion.div>` closing the content area (the one with `data?.digest` check ending at line 205) but before `</Shell>`.

---

## Phase 2 — Dashboard Polish

### Task 6: Refine Shell sidebar

**Files:**
- Modify: `components/Shell.tsx`

- [ ] **Step 1: Slim sidebar to 180px, move Check Inbox button into sidebar, soften borders**

In `components/Shell.tsx`:

Change sidebar width from 220 to 180:
```
width: 180, flexShrink: 0,
```

Change sidebar background and border to be softer:
```
background: "#02050a",
borderRight: "1px solid rgba(0,212,255,0.06)",
```

Add a "Check Inbox" button above Sign Out in the sidebar (this requires passing a callback or using a different approach — keep it simple: add a Link to the dashboard and don't duplicate the run-digest button). Actually, per the spec, move "Check Inbox" to the sidebar. Since the sidebar doesn't have access to the `runDigest` function, we'll add a navigation item or just keep it compact. Simplify: remove the top-right "Check Inbox" button from the dashboard page and instead, make the sidebar a bit more refined with the button moved. Since we can't easily lift the runDigest state into Shell, just refine the visual styling.

Changes:
- Sidebar width: 220 → 180
- Background: `rgba(0,0,0,0.96)` → `#02050a`
- Border: `rgba(0,212,255,0.08)` → `rgba(0,212,255,0.06)`
- Sign out color: add hover state
- Nav items: softer transitions

---

### Task 7: Refine DigestOverview category cards

**Files:**
- Modify: `components/dashboard/DigestOverview.tsx`

- [ ] **Step 1: Softer colors, top accent strip replaces full border**

In `components/dashboard/DigestOverview.tsx`, update the card styles:

The `CATS` array stays the same. Change the card render:
- Replace full border with top accent strip only
- Softer background tint
- Add `fontVariantNumeric: "tabular-nums"` to count numbers
- Softer percentage text

Update the card style (around line 28-39):
```typescript
style={{
  borderRadius: 10, overflow: "hidden",
  background: `${color}06`,
  borderTop: `2px solid ${color}55`,
}}
```

And the count number (around line 48-53):
```typescript
style={{
  fontSize: 26, fontWeight: 700, color: "#edf6ff",
  letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 10,
  fontVariantNumeric: "tabular-nums",
}}
```

---

### Task 8: Refine EmailList

**Files:**
- Modify: `components/dashboard/EmailList.tsx`

- [ ] **Step 1: Tighter rows, softer category badges, simpler dot+label format**

In `components/dashboard/EmailList.tsx`, update the category badge from bordered pill to dot+label:

Change the badge span style (around line 82-89):
```typescript
<span style={{
  flexShrink: 0, fontSize: 9, fontWeight: 600,
  fontFamily: "monospace", textTransform: "uppercase",
  letterSpacing: "0.06em",
  color, display: "flex", alignItems: "center", gap: 4,
}}>
  <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }} />
  {email.category.replace(/_/g, " ")}
</span>
```

Reduce row padding slightly: `padding: "10px 12px"` → `padding: "9px 11px"`

---

### Task 9: Refine ActionQueue

**Files:**
- Modify: `components/dashboard/ActionQueue.tsx`

- [ ] **Step 1: Softer orange accents, simplify button labels**

In `components/dashboard/ActionQueue.tsx`:

Change the orange border-left to softer:
```
borderLeft: "2px solid rgba(249,115,22,0.35)",
```

Change the count badge to be softer:
```
color: "rgba(249,115,22,0.7)",
background: "rgba(249,115,22,0.06)",
border: "1px solid rgba(249,115,22,0.1)",
```

---

## Phase 3 — Onboarding Wizard

### Task 10: Create onboarding page and wizard component

**Files:**
- Create: `app/onboarding/page.tsx`
- Modify: `middleware.ts` — add onboarding redirect

- [ ] **Step 1: Create `app/onboarding/page.tsx`**

Create `app/onboarding/page.tsx`:
```typescript
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
    await fetch("/mailflow/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_step: stepNum, onboarding_completed: completed }),
    });
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
    const res = await fetch("/mailflow/api/digest/run", { method: "POST" });
    const data = await res.json();
    setDigestResult(data);
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
                <input
                  type="email" placeholder="you@example.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 9, outline: "none",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
                    color: "#dde8f0", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
                <input
                  type="password" placeholder="Password" value={password}
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
                <button
                  onClick={handleSignup}
                  disabled={loading || !email || !password}
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
                <button
                  onClick={async () => { await saveProgress(2); setStep(2); }}
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
                <a
                  href="/mailflow/api/auth/google"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    width: "100%", padding: "12px", borderRadius: 9,
                    background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(0,212,255,0.2)",
                    color: "rgba(0,212,255,0.7)", fontSize: 13, fontWeight: 500,
                    textDecoration: "none", fontFamily: "inherit",
                    marginBottom: 16, cursor: "pointer",
                  }}
                >
                  + Connect Gmail Account
                </a>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={async () => { await saveProgress(3); setStep(3); }}
                  style={{
                    flex: 1, padding: "11px", borderRadius: 9, border: "none",
                    background: "linear-gradient(135deg, #00b4db, #0083b0)",
                    color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Continue
                </button>
              </div>
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
                  <input
                    type="text" value={telegramChatId}
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
                  <input
                    type="text" value={slackWebhook}
                    onChange={e => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: 8, outline: "none",
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,212,255,0.1)",
                      color: "#dde8f0", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleChannelsSubmit}
                    disabled={loading}
                    style={{
                      flex: 1, padding: "11px", borderRadius: 9, border: "none",
                      background: "linear-gradient(135deg, #00b4db, #0083b0)",
                      color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: "0 0 16px rgba(0,212,255,0.2)",
                    }}
                  >
                    {loading ? "Running first digest..." : "Finish Setup"}
                  </button>
                </div>
                <button
                  onClick={handleChannelsSubmit}
                  style={{
                    background: "none", border: "none", color: "rgba(221,232,240,0.2)",
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Skip — I&apos;ll set this up later
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
                  Your AI inbox assistant is ready. We&apos;ll run digests automatically and notify you.
                </p>

                {digestResult && !digestResult.error && (
                  <div style={{
                    padding: "14px 16px", borderRadius: 10, marginBottom: 20,
                    background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)",
                    textAlign: "left",
                  }}>
                    <p style={{ fontSize: 12, color: "rgba(221,232,240,0.5)", lineHeight: 1.6 }}>
                      First digest complete! {JSON.stringify(digestResult)}
                    </p>
                  </div>
                )}

                <button
                  onClick={finish}
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
```

- [ ] **Step 2: Add onboarding redirect to middleware**

In `middleware.ts`, after the auth check (around line 34), add an onboarding redirect:

After the existing auth check block, add:
```typescript
  // Onboarding redirect — if user is logged in but hasn't completed onboarding
  if (user && !isPublic && normalizedPath !== "/onboarding") {
    // Skip check for API routes
    if (!isApi) {
      const supabaseAdmin = createServerClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      });

      const { data: onboarding } = await supabaseAdmin
        .from("onboarding_progress")
        .select("completed")
        .eq("user_id", user.id)
        .maybeSingle();

      // If no onboarding record or not completed, redirect
      if (!onboarding || !onboarding.completed) {
        const onboardingUrl = new URL("/mailflow/onboarding", req.url);
        return NextResponse.redirect(onboardingUrl);
      }
    }
  }
```

Note: This onboarding check uses the service role key to query the `onboarding_progress` table. If the service role key is not available, fall back to the anon key. If neither works, skip the check (graceful degradation).

---

## Phase 4 — Landing Page + Pricing

### Task 11: Add PricingSection and HowItWorksSection to landing page

**Files:**
- Modify: `components/landing/LandingPage.tsx` — add pricing section before the final CTA section

- [ ] **Step 1: Add pricing tiers data and pricing section component to LandingPage.tsx**

In `components/landing/LandingPage.tsx`, add this before the final CTA section (before `{/* ════════════ FINAL CTA ════════════ */}`):

```typescript
const PRICING_TIERS = [
  {
    name: "Starter",
    price: "Free",
    period: "",
    desc: "For individuals getting started with AI inbox management.",
    features: ["1 Gmail account", "1 digest per day", "Basic AI replies", "Web dashboard"],
    cta: "Get Started",
    href: "/login",
    featured: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    desc: "For professionals who want full control over their inbox.",
    features: ["3 Gmail accounts", "3 digests per day", "Custom tone AI replies", "Telegram notifications", "Slack notifications", "Email support"],
    cta: "Start Free Trial",
    href: "/login",
    featured: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/mo",
    desc: "For teams and agencies managing multiple inboxes.",
    features: ["Unlimited Gmail accounts", "Hourly digests", "Priority AI processing", "Telegram + Slack", "Priority chat support", "Team management"],
    cta: "Contact Us",
    href: "/login",
    featured: false,
  },
];

{/* Then insert the pricing section before FINAL CTA */}
{/* ════════════ PRICING ════════════ */}
<section id="pricing" style={{
  position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto",
  padding: "88px 28px",
}}>
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    style={{ textAlign: "center", marginBottom: 52 }}
  >
    <p style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em",
      color: "rgba(0,212,255,0.6)", fontFamily: "monospace",
      marginBottom: 12, textTransform: "uppercase",
    }}>
      PRICING
    </p>
    <h2 style={{
      fontSize: "clamp(22px, 3.5vw, 34px)", fontWeight: 700,
      color: "#edf6ff", letterSpacing: "-0.025em",
    }}>
      Simple, transparent pricing.
    </h2>
  </motion.div>

  <div style={{
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18, alignItems: "start",
  }}>
    {PRICING_TIERS.map((tier, i) => (
      <motion.div
        key={tier.name}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          borderRadius: 16, padding: "32px 28px",
          background: tier.featured ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.015)",
          border: tier.featured
            ? "1px solid rgba(0,212,255,0.2)"
            : "1px solid rgba(255,255,255,0.06)",
          boxShadow: tier.featured
            ? "0 0 32px rgba(0,212,255,0.08), 0 0 0 1px rgba(0,212,255,0.04) inset"
            : "none",
          position: "relative",
          transform: tier.featured ? "scale(1.03)" : "scale(1)",
        }}
      >
        {tier.featured && (
          <div style={{
            position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)",
            padding: "3px 14px", borderRadius: 99,
            background: "linear-gradient(135deg, #00b4db, #0083b0)",
            fontSize: 10, fontWeight: 600, color: "#fff",
            fontFamily: "monospace", letterSpacing: "0.06em",
          }}>
            MOST POPULAR
          </div>
        )}

        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#edf6ff", marginBottom: 6 }}>
          {tier.name}
        </h3>
        <p style={{ fontSize: 12, color: "rgba(221,232,240,0.4)", lineHeight: 1.55, marginBottom: 18 }}>
          {tier.desc}
        </p>

        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#edf6ff", letterSpacing: "-0.03em" }}>
            {tier.price}
          </span>
          <span style={{ fontSize: 14, color: "rgba(221,232,240,0.3)", marginLeft: 2 }}>
            {tier.period}
          </span>
        </div>

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {tier.features.map(f => (
            <li key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={12} style={{ color: tier.featured ? "#00d4ff" : "rgba(0,212,255,0.3)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "rgba(221,232,240,0.55)" }}>{f}</span>
            </li>
          ))}
        </ul>

        <a
          href={tier.href}
          style={{
            display: "block", textAlign: "center", padding: "10px 20px", borderRadius: 9,
            background: tier.featured
              ? "linear-gradient(135deg, #00b4db, #0083b0)"
              : "rgba(255,255,255,0.04)",
            border: tier.featured ? "none" : "1px solid rgba(255,255,255,0.1)",
            color: tier.featured ? "#fff" : "rgba(221,232,240,0.5)",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
            fontFamily: "inherit",
            boxShadow: tier.featured ? "0 0 20px rgba(0,212,255,0.2)" : "none",
          }}
        >
          {tier.cta}
        </a>
      </motion.div>
    ))}
  </div>
</section>
```

- [ ] **Step 2: Add "Pricing" link to landing header nav**

In the header nav of `LandingPage.tsx`, add a pricing link after the Features link (around line 139):
```typescript
<a href="#pricing" style={{ fontSize: 12.5, color: "rgba(221,232,240,0.55)", textDecoration: "none" }}>
  Pricing
</a>
```

---

## Phase 5 — Telegram Sync

### Task 12: Enable bidirectional Telegram sync

**Files:**
- Modify: `lib/notify.ts` — add function to send Telegram confirmation
- Modify: `app/api/actions/[id]/route.ts` — notify Telegram on web approval

- [ ] **Step 1: Add `notifyTelegramActionResolved` function to `lib/notify.ts`**

Append to `lib/notify.ts`:
```typescript
export async function notifyTelegramActionResolved(
  chatId: string,
  fromName: string,
  subject: string,
  status: "approved" | "rejected",
  source: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const emoji = status === "approved" ? "✅" : "❌";
  const label = status === "approved" ? "Approved" : "Rejected";
  const text = `${emoji} *${label} via ${source}*\n\n*${fromName}* — "${subject}"\n${status === "approved" ? "Reply has been sent." : "Reply was discarded."}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}
```

- [ ] **Step 2: Call notify on web approval in actions route**

In `app/api/actions/[id]/route.ts`, after the `executeAction` call on line 65, add a Telegram notification. Insert after line 69 (`return NextResponse.json({ status: "approved", execution: "success" });`):

Replace lines 62-69 with:
```typescript
    if (newStatus === "approved") {
      const refreshed = await supabase.from("mailflow_actions").select("*").eq("id", id).single();
      if (refreshed.data) {
        const result = await executeAction(refreshed.data);

        // Notify Telegram that action was resolved via web
        if (body.approvedBy === "web") {
          const { data: settings } = await supabase
            .from("mailflow_settings")
            .select("telegram_chat_id")
            .eq("user_id", user.id)
            .maybeSingle();

          if (settings?.telegram_chat_id) {
            const { data: email } = await supabase
              .from("digest_emails")
              .select("from_name, subject")
              .eq("id", action.digest_email_id)
              .single();

            const { notifyTelegramActionResolved } = await import("@/lib/notify");
            notifyTelegramActionResolved(
              settings.telegram_chat_id,
              email?.from_name || "Unknown",
              email?.subject || "(no subject)",
              "approved",
              "web"
            ).catch(() => {});
          }
        }

        if (!result.success) {
          return NextResponse.json({ status: "approved", execution: "failed", error: result.error });
        }
        return NextResponse.json({ status: "approved", execution: "success" });
      }
    }

    // Notify Telegram on web rejection too
    if (newStatus === "rejected" && body.approvedBy === "web") {
      const { data: settings } = await supabase
        .from("mailflow_settings")
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settings?.telegram_chat_id) {
        const { data: email } = await supabase
          .from("digest_emails")
          .select("from_name, subject")
          .eq("id", action.digest_email_id)
          .single();

        const { notifyTelegramActionResolved } = await import("@/lib/notify");
        notifyTelegramActionResolved(
          settings.telegram_chat_id,
          email?.from_name || "Unknown",
          email?.subject || "(no subject)",
          "rejected",
          "web"
        ).catch(() => {});
      }
    }
```

- [ ] **Step 3: Run a quick build check to verify no TypeScript errors**

Run: `cd "D:/Flow-Forges/mailflow" && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from our changes.

---

## Implementation Order

Execute tasks in this order:

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1 → 2 → 3 → 4 → 5 | Chat widget core — tables, logic, API, component, integration |
| 2 | 6 → 7 → 8 → 9 | Dashboard polish — sidebar, cards, email list, actions |
| 3 | 10 | Onboarding wizard — page + middleware redirect |
| 4 | 11 | Landing + pricing section |
| 5 | 12 | Telegram bidirectional sync |

---

## Verification Checklist

After all tasks complete, verify:

1. `http://localhost:3002/mailflow/login` — login works, redirects to onboarding
2. `http://localhost:3002/mailflow/onboarding` — 4-step wizard completes
3. `http://localhost:3002/mailflow/dashboard` — dashboard loads with ChatWidget floating button
4. Chat widget opens, sends message, receives AI response with tool calls
5. Category cards show softer design (top accent, no full border)
6. Action queue shows approve/edit/reject with softer orange
7. Landing page at `/mailflow/` shows pricing section
8. Pricing cards display 3 tiers, Pro featured
9. Telegram `/check-inbox` works as before
10. Actions approved on web send confirmation to Telegram
