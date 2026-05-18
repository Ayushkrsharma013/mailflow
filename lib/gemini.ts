export const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> | undefined;
  if (!candidates?.length) return "";
  const parts = candidates[0]?.content?.parts || [];
  const textPart = parts.find(p => !p.thought);
  return textPart?.text || parts[0]?.text || "";
}

export function extractGeminiFunctionCall(data: Record<string, unknown>): { name: string; args: Record<string, unknown> } | null {
  const candidates = data.candidates as Array<{ content?: { parts?: Array<{ functionCall?: { name: string; args: Record<string, unknown> } }> } }> | undefined;
  if (!candidates?.length) return null;
  const parts = candidates[0]?.content?.parts || [];
  const fc = parts.find(p => p.functionCall)?.functionCall;
  return fc || null;
}
