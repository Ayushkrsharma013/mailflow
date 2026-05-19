import { decryptToken } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/google-auth";
import { encryptToken } from "@/lib/crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { GmailAccount, GmailMessage } from "@/lib/types";

async function getValidAccessToken(account: GmailAccount): Promise<string | null> {
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at).getTime();
    if (Date.now() < expiresAt - 120_000) {
      return decryptToken(account.google_access_token);
    }
  }

  const refreshToken = await decryptToken(account.google_refresh_token);
  const newTokens = await refreshAccessToken(refreshToken);
  if (!newTokens) return null;

  const supabase = await createSupabaseServerClient();
  const encryptedAccess = await encryptToken(newTokens.access_token);
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

  await supabase
    .from("gmail_accounts")
    .update({
      google_access_token: encryptedAccess,
      token_expires_at: expiresAt,
    })
    .eq("id", account.id);

  return newTokens.access_token;
}

async function gmailRequest(account: GmailAccount, path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken(account);
  if (!token) throw new Error(`Failed to get valid access token for ${account.email}`);

  const url = `https://gmail.googleapis.com/gmail/v1/users/me${path}`;
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function fetchUnreadMessages(account: GmailAccount, maxResults = 100): Promise<GmailMessage[]> {
  const res = await gmailRequest(account, `/messages?q=is:unread%20newer_than:2d&maxResults=${maxResults}`);
  if (!res.ok) {
    const errData = (await res.json()) as Record<string, unknown>;
    console.error(`[Gmail] fetchUnreadMessages failed for ${account.email} (${res.status}):`, JSON.stringify(errData));
    return [];
  }
  const data = (await res.json()) as { messages?: { id: string; threadId: string }[] };
  if (!data.messages) return [];

  const messages: GmailMessage[] = [];
  for (const msg of data.messages) {
    const detailRes = await gmailRequest(account, `/messages/${msg.id}?format=full`);
    const detail = (await detailRes.json()) as Record<string, unknown>;
    messages.push(parseGmailMessage(msg.id, msg.threadId, detail));
  }

  return messages;
}

export async function fetchSentMessages(account: GmailAccount, maxResults = 5): Promise<string[]> {
  const res = await gmailRequest(account, `/messages?q=in:sent&maxResults=${maxResults}`);
  const data = (await res.json()) as { messages?: { id: string }[] };
  if (!data.messages) return [];

  const sentBodies: string[] = [];
  for (const msg of data.messages) {
    const detailRes = await gmailRequest(account, `/messages/${msg.id}?format=full`);
    const detail = (await detailRes.json()) as Record<string, unknown>;
    const body = extractPlainTextBody(detail);
    if (body) sentBodies.push(body);
  }

  return sentBodies;
}

export async function sendReply(account: GmailAccount, threadId: string, to: string, subject: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const raw = buildEmail({ to, subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`, body, threadId });
  const res = await gmailRequest(account, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const err = (await res.json()) as Record<string, unknown>;
    return { sent: false, error: (err.error as { message?: string })?.message || `Gmail API error ${res.status}` };
  }

  return { sent: true };
}

export async function archiveMessage(account: GmailAccount, messageId: string): Promise<boolean> {
  const res = await gmailRequest(account, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
  return res.ok;
}

export async function snoozeMessage(account: GmailAccount, messageId: string): Promise<boolean> {
  const labelRes = await gmailRequest(account, "/labels");
  const labelData = (await labelRes.json()) as { labels?: { id: string; name: string }[] };
  let snoozeLabelId = labelData.labels?.find(l => l.name === "Snoozed")?.id;

  if (!snoozeLabelId) {
    const createRes = await gmailRequest(account, "/labels", {
      method: "POST",
      body: JSON.stringify({
        name: "Snoozed",
        labelListVisibility: "labelShow",
        messageListVisibility: "hide",
      }),
    });
    const created = (await createRes.json()) as { id: string };
    snoozeLabelId = created.id;
  }

  const res = await gmailRequest(account, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ removeLabelIds: ["INBOX"], addLabelIds: [snoozeLabelId] }),
  });
  return res.ok;
}

function parseGmailMessage(id: string, threadId: string, raw: Record<string, unknown>): GmailMessage {
  const headers = (raw.payload as { headers?: { name: string; value: string }[] })?.headers || [];
  const from = headers.find(h => h.name === "From")?.value || "";
  const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)";
  const date = headers.find(h => h.name === "Date")?.value || "";
  const { name, email } = parseFromHeader(from);

  return {
    id,
    threadId,
    from,
    fromName: name,
    fromEmail: email,
    subject,
    snippet: (raw.snippet as string) || "",
    bodyText: extractPlainTextBody(raw),
    receivedAt: date,
  };
}

function extractPlainTextBody(raw: Record<string, unknown>): string {
  const payload = raw.payload as Record<string, unknown> | undefined;
  if (!payload) return "";

  const parts = payload.parts as Record<string, unknown>[] | undefined;
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === "text/plain") {
        return base64UrlDecode((part.body as { data?: string })?.data || "");
      }
    }
  }

  const bodyData = (payload.body as { data?: string })?.data;
  if (bodyData) return base64UrlDecode(bodyData);

  return "";
}

function base64UrlDecode(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^"?([^"]*)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  const angleMatch = from.match(/<([^>]+)>/);
  if (angleMatch) return { name: from.replace(/<[^>]+>/, "").trim(), email: angleMatch[1].trim() };
  return { name: "", email: from.trim() };
}

function buildEmail({ to, subject, body, threadId }: { to: string; subject: string; body: string; threadId?: string }): string {
  const lines: string[] = [];
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${subject}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("MIME-Version: 1.0");
  if (threadId) {
    lines.push(`In-Reply-To: <${threadId}>`);
    lines.push(`References: <${threadId}>`);
  }
  lines.push("");
  lines.push(body);

  return Buffer.from(lines.join("\r\n")).toString("base64url");
}
