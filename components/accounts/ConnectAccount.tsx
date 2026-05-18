"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GmailAccountSummary {
  id: string;
  email: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export default function ConnectAccount() {
  const [accounts, setAccounts] = useState<GmailAccountSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/mailflow/api/gmail/accounts")
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []))
      .finally(() => setLoading(false));
  }, []);

  async function removeAccount(id: string) {
    await fetch("/mailflow/api/gmail/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: id }),
    });
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  if (loading) {
    return <div className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {accounts.map(account => (
        <div key={account.id} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div>
            <p className="text-sm font-medium">{account.email}</p>
            <p className="text-xs text-white/40">
              {account.last_synced_at
                ? `Last synced: ${new Date(account.last_synced_at).toLocaleString()}`
                : "Never synced"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${account.is_active ? "bg-green-400" : "bg-red-400"}`} />
            <button
              onClick={() => removeAccount(account.id)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      ))}

      <Link
        href="/mailflow/api/auth/google"
        className="block w-full py-3 rounded-xl border border-dashed border-white/20 text-center text-sm text-white/50 hover:text-white hover:border-white/40 transition-colors"
      >
        + Connect Gmail Account
      </Link>
    </div>
  );
}
