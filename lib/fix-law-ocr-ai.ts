/**
 * Shared OCR cleanup for law text via Claude (Messages API).
 * Used by admin API and the fix-law-ocr CLI script.
 */

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";

export const DEFAULT_CHUNK_CHARS = 75_000;
export const DEFAULT_INTER_CHUNK_DELAY_MS = 1500;

export function chunkTextForOcrFix(text: string, maxLen: number): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];
  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(i + maxLen, t.length);
    if (end < t.length) {
      const brk = t.lastIndexOf("\n\n", end);
      if (brk > i + maxLen / 3) end = brk + 2;
    }
    chunks.push(t.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(Boolean);
}

export function sanitizeLawContentForDb(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  return s.trim().replace(/\0/g, "").replace(/\\/g, "\\\\");
}

function abortErr(): Error {
  const e = new Error("Aborted");
  e.name = "AbortError";
  return e;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortErr());
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortErr());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function getClaudeModelForOcrFix(): string {
  return process.env.CLAUDE_MODEL || "claude-haiku-4-5";
}

export async function cleanLawChunkWithClaude(params: {
  chunk: string;
  partIndex: number;
  totalParts: number;
  titleHint?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { chunk, partIndex, totalParts, titleHint, signal } = params;
  const claudeKey = process.env.CLAUDE_API_KEY;
  if (!claudeKey || claudeKey.length < 20) {
    throw new Error("Missing or invalid CLAUDE_API_KEY");
  }
  const claudeModel = getClaudeModelForOcrFix();

  const prompt = `You are cleaning OCR output from a legal statute for a law library.

Problems in the source: garbled words, wrong characters, stray symbols, duplicated noise lines, broken spacing. The screenshot-style garbage might look like "DRA APEST AGTE XV" or random codes mixed with real lines.

Tasks:
1. Fix obvious misspellings and restore standard legal phrases (e.g. PROCLAMATION, INCOME TAX, sections) where the intent is clear from context.
2. Remove lines that are pure OCR noise with no legal meaning (random letters, meaningless tokens).
3. Keep all substantive legal text, section numbers, dates, and citation-style references that are valid.
4. Preserve paragraph breaks and reading order. If headings are clear, you may use lines starting with ## for a short heading, then blank line, then body (Markdown-style), or plain paragraphs only — be consistent within this excerpt.
5. This is part ${partIndex + 1} of ${totalParts} of the same instrument${titleHint ? ` (${titleHint})` : ""}. Do not repeat boilerplate title pages if this is a middle/last chunk.

Law text to clean:
---
${chunk}
---

Output ONLY the cleaned text for this part. No preamble, no "Here is", no markdown code fences.`;

  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel,
      max_tokens: 16_384,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const blocks = json.content;
  const text = Array.isArray(blocks)
    ? blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
    : "";
  return text
    .trim()
    .replace(/^```[\w]*\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();
}

export async function cleanFullLawTextWithClaude(params: {
  raw: string;
  lawTitle: string;
  chunkChars?: number;
  delayMs?: number;
  signal?: AbortSignal;
  /** Called before each Claude request (chunk `partIndex` of `totalParts`). */
  onChunkProgress?: (info: { partIndex: number; totalParts: number }) => void;
}): Promise<string> {
  const {
    raw,
    lawTitle,
    chunkChars = DEFAULT_CHUNK_CHARS,
    delayMs = DEFAULT_INTER_CHUNK_DELAY_MS,
    signal,
    onChunkProgress,
  } = params;
  const maxLen = Math.max(20_000, chunkChars);
  const parts = chunkTextForOcrFix(raw, maxLen);
  const cleanedPieces: string[] = [];
  for (let p = 0; p < parts.length; p++) {
    if (signal?.aborted) throw abortErr();
    onChunkProgress?.({ partIndex: p, totalParts: parts.length });
    const cleaned = await cleanLawChunkWithClaude({
      chunk: parts[p],
      partIndex: p,
      totalParts: parts.length,
      titleHint: lawTitle,
      signal,
    });
    cleanedPieces.push(cleaned);
    if (p < parts.length - 1) await sleep(delayMs, signal);
  }
  let merged = cleanedPieces.join("\n\n").trim();
  merged = sanitizeLawContentForDb(merged) ?? "";
  return merged;
}
