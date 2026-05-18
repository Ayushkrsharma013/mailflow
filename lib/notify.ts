import type { DigestNotificationPayload } from "@/lib/types";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendDigestTelegram(chatId: string, payload: DigestNotificationPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const timeLabel = getTimeLabel();
  const lines: string[] = [
    `📬 *MailFlow — ${timeLabel} Digest*`,
    `${payload.totalEmails} new emails across ${payload.accountsCount} account${payload.accountsCount > 1 ? "s" : ""}`,
    "",
  ];

  if (payload.urgentCount > 0) {
    lines.push(`🔴 *${payload.urgentCount} Urgent*`);
  }
  if (payload.actionCount > 0) {
    lines.push(`🟡 *${payload.actionCount} Need Action*`);
  }

  if (payload.pendingActions.length > 0) {
    lines.push("");
    for (const action of payload.pendingActions.slice(0, 5)) {
      lines.push(`• "${action.subject}" from ${action.fromName}`);
      lines.push(`  Draft: ${action.draftReply.slice(0, 100)}...`);
    }
    if (payload.pendingActions.length > 5) {
      lines.push(`  ...and ${payload.pendingActions.length - 5} more`);
    }
  }

  lines.push("");
  lines.push(`🔵 *${payload.fyiCount} FYI* — newsletters, team updates, CCs`);
  if (payload.promoCount > 0) lines.push(`🟢 *${payload.promoCount} Promotions* — auto-archived`);
  if (payload.spamCount > 0) lines.push(`⚪ *${payload.spamCount} Spam* — auto-archived`);
  lines.push("");
  lines.push(payload.summary);
  lines.push("");
  lines.push("Review actions: app.flow-forges.com/mailflow/dashboard");

  const summaryText = lines.join("\n");
  await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: summaryText,
      parse_mode: "Markdown",
    }),
  });

  for (const action of payload.pendingActions) {
    await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `*${action.fromName}* — "${action.subject}"\n\n${action.draftReply}`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "Approve ✅", callback_data: `approve:${action.id}` },
            { text: "Reject ❌", callback_data: `reject:${action.id}` },
          ]],
        },
      }),
    });
  }
}

export async function sendDigestSlack(webhookUrl: string, payload: DigestNotificationPayload): Promise<void> {
  const timeLabel = getTimeLabel();
  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📬 MailFlow — ${timeLabel} Digest` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${payload.totalEmails} new emails across ${payload.accountsCount} account${payload.accountsCount > 1 ? "s" : ""}\n🔴 ${payload.urgentCount} Urgent · 🟡 ${payload.actionCount} Need Action · 🔵 ${payload.fyiCount} FYI`,
      },
    },
  ];

  for (const action of payload.pendingActions.slice(0, 5)) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${action.fromName}* — "${action.subject}"\n${action.draftReply.slice(0, 200)}`,
      },
    });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve ✅" },
          style: "primary",
          value: `approve:${action.id}`,
          action_id: "mailflow_approve",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject ❌" },
          style: "danger",
          value: `reject:${action.id}`,
          action_id: "mailflow_reject",
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: payload.summary }],
  });

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
}

export async function notifyTelegramActionResolved(
  chatId: string,
  fromName: string,
  subject: string,
  status: "approved" | "rejected",
  source: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const emoji = status === "approved" ? "✅" : "❌";
  const label = status === "approved" ? "Approved" : "Rejected";
  const text = `${emoji} *${label} via ${source}*\n\n*${fromName}* — "${subject}"\n${status === "approved" ? "Reply has been sent." : "Reply was discarded."}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

function getTimeLabel(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
