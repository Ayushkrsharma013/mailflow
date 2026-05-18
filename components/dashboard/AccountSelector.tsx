"use client";

import { useEffect, useState } from "react";

export default function AccountSelector() {
  const [accounts, setAccounts] = useState<{ id: string; email: string; is_active: boolean }[]>([]);

  useEffect(() => {
    fetch("/mailflow/api/gmail/accounts")
      .then(r => r.json())
      .then(d => setAccounts(d.accounts || []));
  }, []);

  if (accounts.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {accounts.filter(a => a.is_active).map(a => (
        <span key={a.id} className="px-2 py-1 rounded bg-white/[0.05] text-xs text-white/50 border border-white/5">
          {a.email}
        </span>
      ))}
    </div>
  );
}
