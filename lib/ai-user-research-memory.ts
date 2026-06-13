import {
  resolveCategoryFromMultilingualQuery,
  resolveCountryFromMultilingualQuery,
} from "@/lib/ai-multilingual-search";

/** Minimal persisted chat session shape from `ai_chat_states.data`. */
export type AiChatSessionForMemory = {
  id: string;
  title: string;
  messages: Array<{ role: string; content: string }>;
  updatedAt: number;
};

export type UserResearchMemorySnapshot = {
  countries: string[];
  frameworks: string[];
  categories: string[];
  recentSessionTitles: string[];
  priorUserQuestions: string[];
};

const MAX_SESSIONS_SCAN = 30;
const MAX_PRIOR_QUESTIONS = 10;
const MAX_QUESTIONS_PER_SESSION = 2;
const MAX_QUESTION_CHARS = 140;
const MAX_TITLE_CHARS = 80;
const MAX_PROMPT_BLOCK_CHARS = 1800;

const FRAMEWORK_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "OHADA", re: /\b(ohada|auscgie|ausc\b|audcg|acte\s+uniforme|uniform\s+act)\b/i },
  { label: "AfCFTA", re: /\b(afcfta|zlec|zone\s+de\s+libre[\-\s]?échange\s+continentale)\b/i },
  { label: "ECOWAS", re: /\b(ecowas|cedeao|communauté\s+économique\s+des\s+états\s+de\s+l'afrique\s+de\s+l'ouest)\b/i },
  { label: "SADC", re: /\b(sadc|cdao|southern\s+african\s+development\s+community)\b/i },
  { label: "COMESA", re: /\b(comesa)\b/i },
  { label: "EAC", re: /\b(eac|east\s+african\s+community|communauté\s+est[\-\s]?africaine)\b/i },
  { label: "ECCAS", re: /\b(eccas|cemac|ceeac)\b/i },
];

function truncateText(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function detectFrameworks(text: string): string[] {
  const found = new Set<string>();
  for (const { label, re } of FRAMEWORK_PATTERNS) {
    if (re.test(text)) found.add(label);
  }
  return [...found];
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topKeys(map: Map<string, number>, limit: number): string[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

function userQuestionsFromSession(
  session: AiChatSessionForMemory
): string[] {
  const questions: string[] = [];
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    if (msg.role !== "user") continue;
    const content = msg.content?.trim();
    if (!content) continue;
    questions.push(truncateText(content, MAX_QUESTION_CHARS));
    if (questions.length >= MAX_QUESTIONS_PER_SESSION) break;
  }
  return questions;
}

export function normalizeAiChatSessionsForMemory(raw: unknown): AiChatSessionForMemory[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChatSessionForMemory[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) continue;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const updatedAt = typeof row.updatedAt === "number" ? row.updatedAt : 0;
    const rawMessages = Array.isArray(row.messages) ? row.messages : [];
    const messages = rawMessages
      .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === "object"))
      .map((m) => ({
        role: typeof m.role === "string" ? m.role : "",
        content: typeof m.content === "string" ? m.content : "",
      }))
      .filter((m) => m.role === "user" || m.role === "assistant");
    if (messages.length === 0) continue;
    out.push({ id, title, messages, updatedAt });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS_SCAN);
}

/** Build a cross-chat memory snapshot from saved sessions (excluding the active thread). */
export function buildUserResearchMemorySnapshot(
  sessions: AiChatSessionForMemory[],
  options?: { excludeSessionId?: string | null }
): UserResearchMemorySnapshot | null {
  const excludeId = options?.excludeSessionId?.trim() || null;
  const otherSessions = sessions.filter((s) => !excludeId || s.id !== excludeId);
  if (otherSessions.length === 0) return null;

  const countryCounts = new Map<string, number>();
  const frameworkCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const recentSessionTitles: string[] = [];
  const priorUserQuestions: string[] = [];

  for (const session of otherSessions) {
    const title = session.title.trim();
    if (title && recentSessionTitles.length < 5) {
      recentSessionTitles.push(truncateText(title, MAX_TITLE_CHARS));
    }

    for (const question of userQuestionsFromSession(session)) {
      if (priorUserQuestions.length >= MAX_PRIOR_QUESTIONS) break;
      if (!priorUserQuestions.includes(question)) {
        priorUserQuestions.push(question);
      }
    }

    for (const msg of session.messages) {
      if (msg.role !== "user") continue;
      const content = msg.content?.trim();
      if (!content) continue;
      const country = resolveCountryFromMultilingualQuery(content);
      if (country) incrementCount(countryCounts, country);
      const category = resolveCategoryFromMultilingualQuery(content);
      if (category) incrementCount(categoryCounts, category);
      for (const framework of detectFrameworks(content)) {
        incrementCount(frameworkCounts, framework);
      }
    }
  }

  const snapshot: UserResearchMemorySnapshot = {
    countries: topKeys(countryCounts, 6),
    frameworks: topKeys(frameworkCounts, 6),
    categories: topKeys(categoryCounts, 4),
    recentSessionTitles,
    priorUserQuestions,
  };

  const hasSignal =
    snapshot.countries.length > 0 ||
    snapshot.frameworks.length > 0 ||
    snapshot.categories.length > 0 ||
    snapshot.recentSessionTitles.length > 0 ||
    snapshot.priorUserQuestions.length > 0;

  return hasSignal ? snapshot : null;
}

/** Non-citable orientation block for the model — prior chats, not operative law. */
export function buildUserResearchMemoryPromptBlock(
  memory: UserResearchMemorySnapshot | null
): string | null {
  if (!memory) return null;

  const lines: string[] = [
    "USER RESEARCH MEMORY (from this user's saved prior Yamalé AI Research chats — orientation only; NOT binding law; still retrieve and cite fresh library excerpts with [doc:N] for this turn):",
  ];

  if (memory.countries.length > 0) {
    lines.push(`- Jurisdictions researched before: ${memory.countries.join(", ")}`);
  }
  if (memory.frameworks.length > 0 || memory.categories.length > 0) {
    const topics = [...memory.frameworks, ...memory.categories];
    lines.push(`- Frameworks / topics: ${topics.join(", ")}`);
  }
  if (memory.recentSessionTitles.length > 0) {
    lines.push(
      `- Recent prior chat titles: ${memory.recentSessionTitles.map((t) => `"${t}"`).join("; ")}`
    );
  }
  if (memory.priorUserQuestions.length > 0) {
    lines.push(
      `- Sample prior questions (other chats): ${memory.priorUserQuestions.map((q) => `"${q}"`).join("; ")}`
    );
  }

  lines.push(
    "Use this memory to interpret brief follow-ups in a NEW chat (e.g. \"Et le quorum ?\" may refer to prior OHADA or general-meeting research in another thread). Do not assume unstated facts; if jurisdiction or instrument is unclear, state your assumption briefly or ask one clarifying question. Never treat memory as statute text or cite it with [doc:N]."
  );

  const block = lines.join("\n");
  if (block.length <= MAX_PROMPT_BLOCK_CHARS) return block;
  return `${block.slice(0, MAX_PROMPT_BLOCK_CHARS - 1).trim()}…`;
}
