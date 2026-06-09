import { escapeIlikePattern } from "@/lib/law-country-scope";
import { AI_LEGAL_METHODOLOGY_CATEGORY } from "@/lib/ai-contextual-brain";

export type MethodologyContextDoc = {
  id: string;
  title: string;
  country: string;
  category: string;
  status?: string;
  content: string;
  year?: number;
  retrievalScore?: number;
};

const METHODOLOGY_SELECT =
  "id, title, year, status, content, content_plain, applies_to_all_countries, countries(name), categories!laws_category_id_fkey(name)";

const PRACTICE_MODULE_RE = /yamal[eé]\s+ai\s+brain\s*[—\-]/i;

function envInt(name: string, devDefault: number, prodDefault: number, min: number, max: number): number {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview");
  const raw = process.env[name]?.trim();
  const fallback = isProd ? prodDefault : devDefault;
  if (!raw) return Math.min(max, Math.max(min, fallback));
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return Math.min(max, Math.max(min, fallback));
  return Math.min(max, Math.max(min, n));
}

export function methodologyMaxDocsFromEnv(): number {
  return envInt("AI_METHODOLOGY_MAX_DOCS", 2, 2, 1, 3);
}

export function methodologyMaxCharsPerDocFromEnv(): number {
  return envInt("AI_METHODOLOGY_MAX_CHARS_PER_DOC", 6_000, 4_500, 2_000, 12_000);
}

function pickBody(row: {
  content_plain?: string | null;
  content?: string | null;
}): string {
  const plain = (row.content_plain ?? "").trim();
  if (plain.length >= 200) return plain;
  const html = (row.content ?? "").trim();
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[… excerpt truncated for context budget …]`;
}

function rowToDoc(
  row: Record<string, unknown>,
  maxCharsPerDoc: number
): MethodologyContextDoc | null {
  const body = pickBody(row);
  if (body.length < 100) return null;
  const countryName = row.applies_to_all_countries
    ? "Multiple countries"
    : ((row.countries as { name?: string } | null)?.name ?? "—");
  return {
    id: row.id as string,
    title: String(row.title ?? "AI methodology"),
    country: countryName,
    category: ((row.categories as { name?: string } | null)?.name) ?? AI_LEGAL_METHODOLOGY_CATEGORY,
    status: row.status as string | undefined,
    year: row.year as number | undefined,
    content: truncate(body, maxCharsPerDoc),
    retrievalScore: 1,
  };
}

function deepDiveCountryFromQuery(query: string): string | null {
  const m = query.match(
    /\b(?:legal\s+system|law\s+of|laws\s+of|in)\s+([A-Za-z][A-Za-z\s'-]{2,40}?)(?:'s)?\s+(?:legal|court|law\b)/i
  );
  if (m?.[1]) return m[1].trim();
  const m2 = query.match(/\b([A-Za-z][A-Za-z\s'-]{2,35})\s*'s\s+legal\s+system\b/i);
  if (m2?.[1]) return m2[1].trim();
  const m3 = query.match(
    /\bdescribe\s+(?:the\s+)?([A-Za-z][A-Za-z\s'-]{2,35})(?:'s)?\s+legal\s+system\b/i
  );
  return m3?.[1]?.trim() ?? null;
}

function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4);
}

function isContextualBrainTitle(title: string): boolean {
  return /contextual\s+brain/i.test(title);
}

function isPracticeModuleTitle(title: string): boolean {
  return PRACTICE_MODULE_RE.test(title);
}

function practiceModuleTopic(title: string): string {
  return title.replace(PRACTICE_MODULE_RE, "").trim().toLowerCase();
}

/** Score practice-module titles against query tokens (higher = better match). */
function practiceModuleTitleScore(title: string, tokens: string[]): number {
  if (!isPracticeModuleTitle(title)) return 0;
  const topic = practiceModuleTopic(title);
  let score = 0;
  for (const tok of tokens) {
    if (topic.includes(tok)) score += 12;
    if (tok.length >= 6 && topic.split(/\s+/).some((w) => w.startsWith(tok.slice(0, 5)))) score += 4;
  }
  if (/\bmediation\b/.test(topic) && tokens.some((x) => x === "mediation")) score += 20;
  if (/\bmining\b/.test(topic) && tokens.some((x) => x === "mining")) score += 20;
  if (/\barbitration|litigation\b/.test(topic) && tokens.some((x) => x === "arbitration" || x === "litigation")) {
    score += tokens.includes("mediation") && !tokens.includes("arbitration") ? 4 : 14;
  }
  return score;
}

/**
 * Fetch global AI methodology / legal-system deep-dive rows for RAG (prepended to library hits).
 */
export async function fetchAiMethodologyContext(
  supabase: { from: (table: string) => any },
  query: string,
  options?: { maxDocs?: number; maxCharsPerDoc?: number; countryHint?: string | null }
): Promise<MethodologyContextDoc[]> {
  const maxDocs = options?.maxDocs ?? methodologyMaxDocsFromEnv();
  const maxCharsPerDoc = options?.maxCharsPerDoc ?? methodologyMaxCharsPerDocFromEnv();
  const countryHint = options?.countryHint ?? deepDiveCountryFromQuery(query);
  const tokens = queryTokens(query);

  const categoryPromise = supabase
    .from("categories")
    .select("id")
    .eq("name", AI_LEGAL_METHODOLOGY_CATEGORY)
    .limit(1)
    .maybeSingle();

  const { data: categoryRow } = await categoryPromise;
  const categoryId = categoryRow?.id as string | undefined;
  if (!categoryId) return [];

  const out: MethodologyContextDoc[] = [];
  const used = new Set<string>();

  const divePromise = countryHint
    ? supabase
        .from("laws")
        .select(METHODOLOGY_SELECT)
        .eq("category_id", categoryId)
        .or(
          `title.ilike.%${escapeIlikePattern(countryHint)}%,title.ilike.%Legal System Deep Dive%`
        )
        .neq("status", "Repealed")
        .limit(8)
    : Promise.resolve({ data: [] as unknown[], error: null });

  const tokenOrParts =
    tokens.length > 0
      ? tokens.map((t) => {
          const p = `%${escapeIlikePattern(t)}%`;
          return `title.ilike.${p},content_plain.ilike.${p}`;
        })
      : [];

  let candidateQuery = supabase
    .from("laws")
    .select(METHODOLOGY_SELECT)
    .eq("category_id", categoryId)
    .neq("status", "Repealed")
    .limit(40);
  if (tokenOrParts.length > 0) {
    candidateQuery = candidateQuery.or(tokenOrParts.join(","));
  }

  const [{ data: diveRows }, { data: candidateRows, error: candidateErr }] = await Promise.all([
    divePromise,
    candidateQuery,
  ]);

  const candidates = (candidateErr || !Array.isArray(candidateRows) ? [] : candidateRows) as Record<
    string,
    unknown
  >[];

  let bestPracticeScore = 0;
  for (const row of candidates) {
    const title = String(row.title ?? "");
    bestPracticeScore = Math.max(bestPracticeScore, practiceModuleTitleScore(title, tokens));
  }

  const skipContextualBrain = bestPracticeScore >= 12;

  if (!skipContextualBrain) {
    const { data: brainRows } = await supabase
      .from("laws")
      .select(METHODOLOGY_SELECT)
      .eq("category_id", categoryId)
      .ilike("title", "%contextual brain%")
      .neq("status", "Repealed")
      .limit(1);

    if (Array.isArray(brainRows) && brainRows[0]) {
      const doc = rowToDoc(brainRows[0] as Record<string, unknown>, maxCharsPerDoc);
      if (doc) {
        out.push(doc);
        used.add(doc.id);
      }
    }
  }

  if (countryHint && Array.isArray(diveRows)) {
    const hint = escapeIlikePattern(countryHint);
    for (const row of diveRows) {
      if (out.length >= maxDocs) break;
      const title = String((row as { title?: string }).title ?? "").toLowerCase();
      if (!title.includes("deep dive") || !title.includes(hint.toLowerCase().split(/\s+/)[0] ?? "___")) {
        continue;
      }
      const doc = rowToDoc(row as Record<string, unknown>, maxCharsPerDoc);
      if (doc && !used.has(doc.id)) {
        out.push(doc);
        used.add(doc.id);
      }
    }
  }

  if (out.length >= maxDocs) return out;

  const ranked = [...candidates].sort((a, b) => {
    const titleA = String(a.title ?? "");
    const titleB = String(b.title ?? "");
    const scoreA =
      practiceModuleTitleScore(titleA, tokens) +
      (isContextualBrainTitle(titleA) ? 2 : 0) +
      tokens.reduce((s, t) => (pickBody(a).toLowerCase().includes(t) ? 1 : s), 0);
    const scoreB =
      practiceModuleTitleScore(titleB, tokens) +
      (isContextualBrainTitle(titleB) ? 2 : 0) +
      tokens.reduce((s, t) => (pickBody(b).toLowerCase().includes(t) ? 1 : s), 0);
    return scoreB - scoreA;
  });

  for (const row of ranked) {
    if (out.length >= maxDocs) break;
    const title = String(row.title ?? "");
    if (skipContextualBrain && isContextualBrainTitle(title)) continue;
    const doc = rowToDoc(row, maxCharsPerDoc);
    if (doc && !used.has(doc.id)) {
      out.push(doc);
      used.add(doc.id);
    }
  }

  return out;
}

/** Non-citable internal reference for the model — never numbered [doc:N] or shown as user sources. */
export function buildMethodologyReferencePromptBlock(docs: MethodologyContextDoc[]): string | null {
  if (!docs.length) return null;
  const body = docs
    .map((d) => `${d.title}\n${d.content}`)
    .join("\n---\n");
  return (
    "INTERNAL METHODOLOGY REFERENCE (reasoning only — never cite with [doc:N]; never name these documents or list them as sources to the user):\n\n" +
    body
  );
}

/** Prepend methodology docs without duplicating ids already in the retrieval set. */
export function prependMethodologyContext<T extends { id: string }>(
  legalContext: T[],
  methodology: MethodologyContextDoc[]
): Array<MethodologyContextDoc | T> {
  if (methodology.length === 0) return legalContext;
  const seen = new Set(legalContext.map((d) => d.id));
  const prepend = methodology.filter((d) => !seen.has(d.id));
  return [...prepend, ...legalContext];
}
