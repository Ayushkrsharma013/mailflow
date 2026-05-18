import { useState } from "react";

interface ActionItem {
  id: string;
  status: string;
  action_type: string;
  action_payload?: Record<string, unknown> | null;
}

export default function ActionQueue({ actions, onAction }: { actions: ActionItem[]; onAction: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const pending = actions.filter(a => a.status === "pending");

  async function handleAction(id: string, status: string, replyBody?: string) {
    await fetch(`/mailflow/api/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, replyBody, approvedBy: "web" }),
    });
    setEditingId(null);
    onAction();
  }

  if (pending.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Pending Actions</h2>
        <p className="text-white/40 text-sm">No pending actions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
        Pending Actions ({pending.length})
      </h2>
      {pending.map(action => {
        const payload = action.action_payload as Record<string, unknown> || {};
        return (
          <div key={action.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
            <p className="text-sm font-medium">{(payload.subject as string) || "Reply"}</p>
            <p className="text-xs text-white/40 mt-1">To: {(payload.to as string) || "unknown"}</p>

            {editingId === action.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  value={editBody}
                  onChange={e => setEditBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-white/30 resize-none"
                  rows={4}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(action.id, "approved", editBody)}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30"
                  >
                    Send Edited
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <p className="text-xs text-white/60 line-clamp-3">
                    {(payload.replyBody as string) || "No draft available"}
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(action.id, "approved")}
                    className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => { setEditingId(action.id); setEditBody((payload.replyBody as string) || ""); }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleAction(action.id, "rejected")}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30"
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
