import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeAction } from "@/lib/actions";

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const payloadStr = params.get("payload");

  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  try {
    const payload = JSON.parse(payloadStr) as Record<string, unknown>;
    const type = payload.type as string;

    if (type === "block_actions") {
      const actions = (payload.actions as Array<{ action_id: string; value: string }>) || [];

      for (const action of actions) {
        if (action.action_id === "mailflow_approve" && action.value?.startsWith("approve:")) {
          const actionId = action.value.replace("approve:", "");
          await handleSlackAction(actionId, "approved", "slack");
        } else if (action.action_id === "mailflow_reject" && action.value?.startsWith("reject:")) {
          const actionId = action.value.replace("reject:", "");
          await handleSlackAction(actionId, "rejected", "slack");
        }
      }
    }

    if (type === "url_verification") {
      return NextResponse.json({ challenge: payload.challenge });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[slack webhook]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function handleSlackAction(actionId: string, status: "approved" | "rejected", approvedBy: string) {
  const supabase = await createSupabaseServerClient();
  const { data: action } = await supabase
    .from("mailflow_actions")
    .select("*")
    .eq("id", actionId)
    .single();

  if (!action) return;

  await supabase
    .from("mailflow_actions")
    .update({ status, approved_by: approvedBy, resolved_at: new Date().toISOString() })
    .eq("id", actionId);

  if (status === "approved") {
    const refreshed = await supabase.from("mailflow_actions").select("*").eq("id", actionId).single();
    if (refreshed.data) {
      await executeAction(refreshed.data);
    }
  }
}
