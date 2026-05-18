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
    const { data: convs } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("user_id", user.id);
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
