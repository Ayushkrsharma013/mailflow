import type { GmailMessage, CategorizedEmail } from "@/lib/types";
import { GEMINI_API, extractGeminiText } from "@/lib/gemini";

const CATEGORIZE_SYSTEM_PROMPT = `You are an expert email triage assistant. Given a list of unread emails, categorize each one.

Categories:
- "urgent" — requires immediate attention (crisis, deadline today, boss/escalation, security alert)
- "action_needed" — needs a reply or action within 1-2 days (meeting requests, client questions, deliverables)
- "fyi" — informational only (newsletters, team updates, CCs, status reports, receipts)
- "promotion" — marketing emails, sales pitches, cold outreach, product announcements
- "spam" — junk, phishing, unsolicited bulk, obvious scam

For action_needed emails, draft a brief reply. For non-action emails, draftReply should be null.
For each email return a JSON object with: id, category, summary (one sentence), suggestedAction (reply|archive|snooze|none), draftReply (string|null).

CRITICAL: Return a JSON array with one object per email. No other text.`;

export async function categorizeEmails(messages: GmailMessage[]): Promise<Map<string, CategorizedEmail>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const emailList = messages.map(m => ({
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
    body: m.bodyText.slice(0, 1500),
  }));

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: CATEGORIZE_SYSTEM_PROMPT }],
      },
      contents: [{
        parts: [{ text: JSON.stringify(emailList) }],
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  const text = extractGeminiText(data);

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Gemini response did not contain valid JSON array");

  const results: CategorizedEmail[] = JSON.parse(jsonMatch[0]);
  const map = new Map<string, CategorizedEmail>();
  for (const item of results) {
    map.set(item.id, item);
  }
  return map;
}

export async function draftReplyWithTone(
  email: GmailMessage,
  sentExamples: string[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const toneExamples = sentExamples.length > 0
    ? `\n\nHere are examples of emails I've sent (match my tone, formality, and signature style):\n${sentExamples.map((e, i) => `${i + 1}. ${e.slice(0, 300)}`).join("\n\n")}`
    : "";

  const prompt = `Draft a brief, professional reply to this email.${toneExamples}

From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyText.slice(0, 2000)}

Write only the reply body — no subject line, no salutation preamble.`;

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  return extractGeminiText(data).trim();
}

export async function generateDigestSummary(
  categorized: Map<string, CategorizedEmail>,
  accountCount: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";

  const breakdown: Record<string, number> = {};
  const urgents: string[] = [];
  for (const [, c] of categorized) {
    breakdown[c.category] = (breakdown[c.category] || 0) + 1;
    if (c.category === "urgent") urgents.push(c.summary);
  }

  const prompt = `Summarize this email digest in 2-3 natural sentences. Today: ${categorized.size} unread emails across ${accountCount} accounts.

Breakdown: ${Object.entries(breakdown).map(([k, v]) => `${v} ${k}`).join(", ")}.
${urgents.length > 0 ? `\nUrgent items: ${urgents.join("; ")}` : ""}

Write a short, clear summary. No preamble, no sign-off.`;

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }],
      }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  return extractGeminiText(data).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function categorizeEmailsBatched(
  messages: GmailMessage[]
): Promise<Map<string, CategorizedEmail>> {
  const CHUNK_SIZE = 10;
  const DELAY_MS = 1100;
  const result = new Map<string, CategorizedEmail>();

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const chunkResult = await categorizeEmails(chunk);
    for (const [id, cat] of chunkResult) {
      result.set(id, cat);
    }
    if (i + CHUNK_SIZE < messages.length) {
      await sleep(DELAY_MS);
    }
  }

  return result;
}

export async function draftRepliesForActions(
  actionEmails: GmailMessage[],
  sentExamples: string[]
): Promise<Map<string, string>> {
  if (actionEmails.length === 0) return new Map();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const toneExamples = sentExamples.length > 0
    ? `\n\nExamples of my sent emails (match tone and style):\n${sentExamples.map((e, i) => `${i + 1}. ${e.slice(0, 300)}`).join("\n\n")}`
    : "";

  const emailList = actionEmails.map(e => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    body: e.bodyText.slice(0, 1500),
  }));

  const prompt = `Draft brief, professional replies for these emails.${toneExamples}

Emails:
${JSON.stringify(emailList, null, 2)}

Return a JSON array: [{ "id": "...", "reply": "..." }, ...]
Write only the reply body — no subject line, no salutation preamble.
CRITICAL: Return a valid JSON array only, no other text.`;

  const res = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  const data2 = (await res.json()) as Record<string, unknown>;
  const text = extractGeminiText(data2);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return new Map();

  const results = JSON.parse(jsonMatch[0]) as { id: string; reply: string }[];
  return new Map(results.map(r => [r.id, r.reply]));
}

