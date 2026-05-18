export default function DigestOverview({ digest }: { digest: Record<string, unknown> }) {
  const categories = (digest.categories as Record<string, number>) || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[
        { key: "urgent", label: "Urgent", color: "#ef4444" },
        { key: "action_needed", label: "Action", color: "#f59e0b" },
        { key: "fyi", label: "FYI", color: "#3b82f6" },
        { key: "promotion", label: "Promo", color: "#22c55e" },
        { key: "spam", label: "Spam", color: "#6b7280" },
      ].map(({ key, label, color }) => (
        <div key={key} className="p-4 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-sm text-white/50">{label}</span>
          </div>
          <span className="text-2xl font-bold">{categories[key] || 0}</span>
        </div>
      ))}
      {Boolean(digest.summary) && (
        <div className="col-span-full mt-2 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <p className="text-sm text-white/60">{String(digest.summary || "")}</p>
        </div>
      )}
    </div>
  );
}
