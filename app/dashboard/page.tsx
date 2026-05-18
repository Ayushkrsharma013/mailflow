"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import DigestOverview from "@/components/dashboard/DigestOverview";
import EmailList from "@/components/dashboard/EmailList";
import ActionQueue from "@/components/dashboard/ActionQueue";
import AccountSelector from "@/components/dashboard/AccountSelector";

export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<{ digest: Record<string, any>; emails: any[]; actions: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function fetchLatest() {
    setLoading(true);
    const res = await fetch("/mailflow/api/digest/latest");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function runDigest() {
    setRunning(true);
    setError("");
    const res = await fetch("/mailflow/api/digest/run", { method: "POST" });
    const json = await res.json();
    if (json.error) {
      setError(json.error);
    } else {
      await fetchLatest();
    }
    setRunning(false);
  }

  useEffect(() => { fetchLatest(); }, []);

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inbox Digest</h1>
          <div className="flex items-center gap-3">
            <AccountSelector />
            <button
              onClick={runDigest}
              disabled={running}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-black font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {running ? "Checking..." : "Check Inbox"}
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : data?.digest ? (
          <>
            <DigestOverview digest={data.digest} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmailList emails={data.emails} />
              <ActionQueue actions={data.actions} onAction={() => fetchLatest()} />
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-white/40">
            <p className="text-lg mb-2">No digests yet</p>
            <p>Click &quot;Check Inbox&quot; to run your first digest.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
