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
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) conversationId = undefined;
    }
    if (!conversationId) {
      const title = userMessage.slice(0, 80) + (userMessage.length > 80 ? "..." : "");
      const { data: conv } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title })
        .select()
        .single();
      if (!conv) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      conversationId = conv.id;
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    // Load history for Gemini context (last 20 messages)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messageHistory: { role: "user" | "assistant"; content: string; toolCalls?: ChatToolCall[] }[] =
      (history || []).map(m => ({
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
      const { text, toolCall } = await sendMessageToGemini(messageHistory);

      if (toolCall) {
        // Record the tool call in history
        messageHistory.push({
          role: "assistant",
          content: text || "",
          toolCalls: [{ name: toolCall.name, args: toolCall.args, status: "pending" }],
        });

        // Execute the tool
        let toolResult: unknown;
        let toolStatus: "done" | "error" = "done";
        try {
          toolResult = await executeToolCall(toolCall.name, toolCall.args, ctx);
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : "Tool error" };
          toolStatus = "error";
        }

        const toolCallRecord: ChatToolCall = {
          name: toolCall.name,
          args: toolCall.args,
          result: toolResult,
          status: toolStatus,
        };
        responseMessages.push({
          role: "assistant",
          content: text,
          toolCalls: [toolCallRecord],
        });

        // Save assistant message with tool call to DB
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          tool_calls: JSON.parse(JSON.stringify([toolCallRecord])),
        });

        // Feed tool result back to Gemini
        messageHistory.push({
          role: "user",
          content: "",
          toolCalls: [toolCallRecord],
        });
      } else {
        // No tool call — final response
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

    return NextResponse.json({ conversationId, messages: responseMessages });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
