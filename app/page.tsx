import Link from "next/link";
import { Mail, MessageCircle, Zap, Shield } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Mail, title: "Multi-Account Inbox", desc: "Connect all your Gmail accounts. One unified digest across every inbox." },
  { icon: Zap, title: "AI Categorization", desc: "Every email sorted — urgent, action-needed, FYI, promotions, spam." },
  { icon: MessageCircle, title: "Telegram + Slack Approvals", desc: "Approve, edit, or reject AI-drafted replies right from chat." },
  { icon: Shield, title: "Privacy First", desc: "Tokens encrypted at rest. AI runs server-side. You control everything." },
];

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold">MailFlow</span>
        <div className="flex items-center gap-4">
          {user ? (
            <Link href="/mailflow/dashboard" className="text-sm px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">
              Dashboard
            </Link>
          ) : (
            <Link href="/mailflow/login" className="text-sm px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors">
              Sign In
            </Link>
          )}
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-6">
          Your inbox, <span className="text-[var(--accent)]">organized by AI</span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-10">
          MailFlow connects to your Gmail accounts, categorizes every email, drafts personalized replies in your tone, and sends you a digest on Telegram or Slack. You approve — it handles the rest.
        </p>
        <Link
          href={user ? "/mailflow/dashboard" : "/mailflow/login"}
          className="inline-flex px-6 py-3 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors"
        >
          {user ? "Go to Dashboard" : "Get Started"}
        </Link>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 gap-6">
        {FEATURES.map(f => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <Icon size={24} className="text-[var(--accent)] mb-4" />
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50">{f.desc}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
