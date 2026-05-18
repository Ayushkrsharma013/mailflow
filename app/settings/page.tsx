"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/mailflow/api/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setSettings(d.settings); });
  }, []);

  async function handleSave() {
    await fetch("/mailflow/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Shell>
      <div className="max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-white/80">Reply Tone</label>
          <div className="flex gap-2">
            {(["professional", "casual", "direct"] as const).map(tone => (
              <button
                key={tone}
                onClick={() => setSettings(s => ({ ...s, tone_style: tone }))}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                  settings.tone_style === tone
                    ? "bg-white text-black"
                    : "bg-white/[0.05] text-white/50 border border-white/10"
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-white/80">Auto-Archive Categories</label>
          <div className="flex flex-wrap gap-2">
            {["promotion", "spam"].map(cat => (
              <label key={cat} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={((settings.auto_archive_categories as string[]) || []).includes(cat)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSettings(s => ({ ...s, auto_archive_categories: [...((s.auto_archive_categories as string[]) || []), cat] }));
                    } else {
                      setSettings(s => ({ ...s, auto_archive_categories: ((s.auto_archive_categories as string[]) || []).filter(c => c !== cat) }));
                    }
                  }}
                />
                <span className="text-sm capitalize">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-white/80">Telegram Chat ID</label>
          <input
            type="text"
            value={(settings.telegram_chat_id as string) || ""}
            onChange={e => setSettings(s => ({ ...s, telegram_chat_id: e.target.value }))}
            placeholder="Get it from @userinfobot on Telegram"
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-white/80">Slack Webhook URL</label>
          <input
            type="text"
            value={(settings.slack_webhook_url as string) || ""}
            onChange={e => setSettings(s => ({ ...s, slack_webhook_url: e.target.value }))}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </Shell>
  );
}
