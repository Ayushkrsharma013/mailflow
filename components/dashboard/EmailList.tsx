const CATEGORY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  action_needed: "#f59e0b",
  fyi: "#3b82f6",
  promotion: "#22c55e",
  spam: "#6b7280",
};

interface EmailItem {
  id: string;
  subject?: string | null;
  from_name?: string | null;
  from_email?: string | null;
  category: string;
  ai_summary?: string | null;
  ai_draft_reply?: string | null;
}

export default function EmailList({ emails }: { emails: EmailItem[] }) {
  if (emails.length === 0) {
    return <p className="text-white/40 text-sm">No emails in this digest.</p>;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Emails</h2>
      {emails.map(email => (
        <div key={email.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{email.subject || "(no subject)"}</p>
              <p className="text-xs text-white/40 mt-0.5">{email.from_name || email.from_email}</p>
            </div>
            <span
              className="shrink-0 px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: CATEGORY_COLORS[email.category] + "20", color: CATEGORY_COLORS[email.category] }}
            >
              {email.category.replace(/_/g, " ")}
            </span>
          </div>
          {email.ai_summary && (
            <p className="text-xs text-white/50 mt-2">{email.ai_summary}</p>
          )}
          {email.ai_draft_reply && (
            <div className="mt-2 p-2 rounded bg-white/[0.03] border border-white/5">
              <p className="text-xs text-white/50 mb-1">AI Draft:</p>
              <p className="text-xs text-white/70 line-clamp-2">{email.ai_draft_reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
