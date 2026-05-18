"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, Mail, Settings, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/mailflow/login");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-white/10 bg-[var(--surface)] p-4 flex flex-col">
        <Link href="/mailflow/dashboard" className="text-lg font-bold mb-8 px-2">
          MailFlow
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === `/mailflow${item.href}`;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={`/mailflow${item.href}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
