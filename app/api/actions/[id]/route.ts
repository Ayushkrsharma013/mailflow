import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeAction } from "@/lib/actions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: action } = await supabase
    .from("mailflow_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });
  if (action.status !== "pending") {
    return NextResponse.json({ error: `Action already ${action.status}` }, { status: 400 });
  }

  try {
    const body = (await req.json()) as { status: string; replyBody?: string; approvedBy?: string };
    const newStatus = body.status as "approved" | "rejected";

    if (newStatus !== "approved" && newStatus !== "rejected") {
      return NextResponse.json({ error: "Status must be 'approved' or 'rejected'" }, { status: 400 });
    }

    if (newStatus === "approved" && body.replyBody) {
      await supabase
        .from("mailflow_actions")
        .update({
          action_payload: { ...(action.action_payload as Record<string, unknown> || {}), replyBody: body.replyBody },
          status: "approved",
          approved_by: body.approvedBy || "web",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else if (newStatus === "approved") {
      await supabase
        .from("mailflow_actions")
        .update({
          status: "approved",
          approved_by: body.approvedBy || "web",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      await supabase
        .from("mailflow_actions")
        .update({
          status: "rejected",
          approved_by: body.approvedBy || "web",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    if (newStatus === "approved") {
      const refreshed = await supabase.from("mailflow_actions").select("*").eq("id", id).single();
      if (refreshed.data) {
        const result = await executeAction(refreshed.data);
        if (!result.success) {
          return NextResponse.json({ status: "approved", execution: "failed", error: result.error });
        }
        return NextResponse.json({ status: "approved", execution: "success" });
      }
    }

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
