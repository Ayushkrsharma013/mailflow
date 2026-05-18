import type { ChatToolCall } from "@/lib/types";
import { GEMINI_API, extractGeminiText, extractGeminiFunctionCall } from "@/lib/gemini";

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

  try {
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

        if (args.emailId) query = query.eq("id", args.emailId);
        if (args.category) query = query.eq("category", args.category);
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

        const { draftReplyWithTone } = await import("@/lib/categorize");

        const draft = await draftReplyWithTone(
          {
            id: email.gmail_message_id,
            from: `${email.from_name} <${email.from_email}>`,
            subject: email.subject || "",
            snippet: email.snippet || "",
            bodyText: email.body_text || "",
            fromName: email.from_name || "",
            fromEmail: email.from_email || "",
            threadId: email.thread_id || "",
            receivedAt: email.created_at,
          },
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

          const errors: string[] = [];
          for (const e of emails as Record<string, unknown>[]) {
            const { data: account } = await supabase.from("gmail_accounts").select("*").eq("id", e.account_id).single();
            if (account) {
              try {
                const { archiveMessage } = await import("@/lib/gmail");
                await archiveMessage(account as Parameters<typeof archiveMessage>[0], e.gmail_message_id as string);
              } catch (err) {
                console.error(`[archive_email] Failed to archive ${e.gmail_message_id}:`, err);
                errors.push(`Failed to archive ${e.gmail_message_id}: ${err instanceof Error ? err.message : String(err)}`);
              }
            }
          }
          return {
            archived: emails.length - errors.length,
            category: args.category,
            ...(errors.length > 0 ? { errors } : {}),
          };
        }

        if (Array.isArray(args.emailIds)) {
          const errors: string[] = [];
          let count = 0;
          for (const emailId of args.emailIds as string[]) {
            const { data: email } = await supabase.from("digest_emails").select("id, gmail_message_id, account_id").eq("id", emailId).eq("user_id", ctx.userId).single();
            if (email) {
              const { data: account } = await supabase.from("gmail_accounts").select("*").eq("id", (email as Record<string, unknown>).account_id).single();
              if (account) {
                try {
                  const { archiveMessage } = await import("@/lib/gmail");
                  await archiveMessage(account as Parameters<typeof archiveMessage>[0], (email as Record<string, unknown>).gmail_message_id as string);
                  count++;
                } catch (err) {
                  console.error(`[archive_email] Failed to archive ${emailId}:`, err);
                  errors.push(`Failed to archive ${emailId}: ${err instanceof Error ? err.message : String(err)}`);
                }
              }
            }
          }
          return {
            archived: count,
            ...(errors.length > 0 ? { errors } : {}),
          };
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
        console.error(`[executeToolCall] Unknown tool called: ${name}`);
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[executeToolCall] Unhandled error in tool "${name}":`, err);
    return { error: `Internal error executing ${name}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function sendMessageToGemini(
  messages: { role: "user" | "assistant"; content: string; toolCalls?: ChatToolCall[] }[],
): Promise<{ text: string | null; toolCall: { name: string; args: Record<string, unknown> } | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const contents = messages.map(m => {
    const parts: Array<Record<string, unknown>> = [];
    if (m.content) parts.push({ text: m.content });
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

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "unable to read error body");
    console.error(`[sendMessageToGemini] Gemini API returned ${res.status}: ${errorBody}`);
    throw new Error(`Gemini API request failed (${res.status}): ${errorBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const text = extractGeminiText(data);
  const functionCall = extractGeminiFunctionCall(data);

  return { text: text || null, toolCall: functionCall };
}
