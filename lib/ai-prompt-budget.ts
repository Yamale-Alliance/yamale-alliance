import {
  buildAiResearchSystemPrompt,
  type BuildAiResearchSystemPromptParams,
  type LegalDoc,
} from "@/lib/ai-system-prompt";
import { estimatePromptTokensFromChars } from "@/lib/ai-perf";

function isProductionEnv(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")
  );
}

function envInt(
  name: string,
  devFallback: number,
  prodFallback: number,
  min: number,
  max: number
): number {
  const raw = process.env[name]?.trim();
  const fallback = isProductionEnv() ? prodFallback : devFallback;
  if (!raw) return Math.min(max, Math.max(min, fallback));
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fallback));
  return Math.min(max, Math.max(min, n));
}

/** Max estimated input tokens for system prompt + user/assistant history (Claude limit ~200k). */
export function maxClaudeInputTokensEstFromEnv(): number {
  return envInt("AI_MAX_INPUT_TOKENS_EST", 185_000, 175_000, 120_000, 195_000);
}

/** Hard cap on system-prompt character length before the model call (safety net). */
export function maxSystemPromptCharsFromEnv(): number {
  return envInt("AI_MAX_SYSTEM_PROMPT_CHARS", 700_000, 620_000, 250_000, 900_000);
}

const CATALOG_TRIM_TARGET = 12_000;
const DOC_CONTENT_FLOOR = 2_500;

export type FitSystemPromptResult = {
  params: BuildAiResearchSystemPromptParams;
  systemPrompt: string;
  trimmed: boolean;
  promptTokensEst: number;
  totalInputTokensEst: number;
};

function truncateDocContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const notice =
    "\n…[excerpt truncated for context limits — open the full instrument in Yamalé /library]…";
  const bodyCap = Math.max(DOC_CONTENT_FLOOR, maxChars - notice.length);
  return `${content.slice(0, bodyCap)}${notice}`;
}

function trimCatalog(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  const lines = t.split("\n");
  const kept: string[] = [];
  let len = 0;
  for (const line of lines) {
    if (len + line.length + 1 > maxChars) break;
    kept.push(line);
    len += line.length + 1;
  }
  return kept.join("\n");
}

function cloneParams(p: BuildAiResearchSystemPromptParams): BuildAiResearchSystemPromptParams {
  return {
    ...p,
    legalContext: p.legalContext.map((d) => ({ ...d })),
  };
}

/**
 * Build the system prompt and shrink catalog / excerpts / doc count until the estimated
 * Claude input (system + conversation) stays under budget. Prevents Q148-style 200k+ overflows.
 */
export function fitSystemPromptToInputBudget(
  params: BuildAiResearchSystemPromptParams,
  options: { userMessagesCharCount: number }
): FitSystemPromptResult {
  let working = cloneParams(params);
  let trimmed = false;
  const maxInputTokens = maxClaudeInputTokensEstFromEnv();
  const maxSystemChars = maxSystemPromptCharsFromEnv();

  const measure = (systemPrompt: string) => {
    const systemTokens = estimatePromptTokensFromChars(systemPrompt.length);
    const historyTokens = estimatePromptTokensFromChars(options.userMessagesCharCount);
    return {
      systemTokens,
      historyTokens,
      totalInputTokensEst: systemTokens + historyTokens,
      systemPrompt,
    };
  };

  let systemPrompt = buildAiResearchSystemPrompt(working);
  let m = measure(systemPrompt);

  const overBudget = () =>
    m.totalInputTokensEst > maxInputTokens || systemPrompt.length > maxSystemChars;

  let guard = 0;
  while (overBudget() && guard < 48) {
    guard += 1;
    trimmed = true;

    const catalog = (working.lawTitleCatalogText ?? "").trim();
    if (catalog.length > CATALOG_TRIM_TARGET) {
      working = {
        ...working,
        lawTitleCatalogText: trimCatalog(catalog, Math.max(CATALOG_TRIM_TARGET, Math.floor(catalog.length * 0.55))),
      };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    const longest = working.legalContext.reduce(
      (best, d, i) => (d.content.length > (best?.content.length ?? 0) ? { i, content: d.content } : best),
      null as { i: number; content: string } | null
    );
    if (longest && longest.content.length > DOC_CONTENT_FLOOR + 500) {
      const nextCap = Math.max(DOC_CONTENT_FLOOR, Math.floor(longest.content.length * 0.72));
      working = {
        ...working,
        legalContext: working.legalContext.map((d, idx) =>
          idx === longest.i ? { ...d, content: truncateDocContent(d.content, nextCap) } : d
        ),
      };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    if (working.legalContext.length > 4) {
      const drop = 1;
      const nextDocs = working.legalContext.slice(0, working.legalContext.length - drop);
      const maxDocs = Math.max(4, (working.legalContextMaxDocs ?? nextDocs.length) - drop);
      working = {
        ...working,
        legalContext: nextDocs,
        legalContextMaxDocs: maxDocs,
      };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    if ((working.germanyAfricaBitInventoryBlock ?? "").trim()) {
      working = { ...working, germanyAfricaBitInventoryBlock: null };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    if ((working.countryBilateralInventoryBlock ?? "").trim()) {
      working = { ...working, countryBilateralInventoryBlock: null };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    if (working.legalContext.length > 0) {
      const perDoc = Math.max(
        DOC_CONTENT_FLOOR,
        Math.floor((maxSystemChars * 0.55) / working.legalContext.length)
      );
      working = {
        ...working,
        legalContext: working.legalContext.map((d) => ({
          ...d,
          content: truncateDocContent(d.content, perDoc),
        })),
      };
      systemPrompt = buildAiResearchSystemPrompt(working);
      m = measure(systemPrompt);
      continue;
    }

    break;
  }

  if (trimmed) {
    console.warn("[ai-prompt-budget] trimmed system prompt", {
      docs: working.legalContext.length,
      catalogChars: (working.lawTitleCatalogText ?? "").length,
      systemChars: systemPrompt.length,
      promptTokensEst: m.systemTokens,
      totalInputTokensEst: m.totalInputTokensEst,
      maxInputTokens,
    });
  }

  return {
    params: working,
    systemPrompt,
    trimmed,
    promptTokensEst: m.systemTokens,
    totalInputTokensEst: m.totalInputTokensEst,
  };
}

/** Merge supplemental laws without duplicating id or title+source (sourcing floor). */
export function mergeLegalContextDeduped<T extends { id?: string; title: string; country: string }>(
  base: readonly T[],
  extra: readonly T[]
): T[] {
  const seenIds = new Set(base.map((d) => d.id).filter((id): id is string => Boolean(id)));
  const seenKeys = new Set(base.map((d) => `${d.title}::${d.country}`.toLowerCase()));
  const out: T[] = [...base];
  for (const doc of extra) {
    if (doc.id && seenIds.has(doc.id)) continue;
    const key = `${doc.title}::${doc.country}`.toLowerCase();
    if (seenKeys.has(key)) continue;
    if (doc.id) seenIds.add(doc.id);
    seenKeys.add(key);
    out.push(doc);
  }
  return out;
}

export function aiRagSourcingFloorFromEnv(): number {
  return envInt("AI_RAG_SOURCING_FLOOR", 8, 8, 0, 20);
}
