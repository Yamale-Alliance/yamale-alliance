/**
 * Display labels for laws in AI Research and library UI.
 * Regional instruments (OHADA, COMESA, SADC, AfCFTA, …) should read as one source,
 * not a random member-state country from duplicate rows.
 */

import type { PreferredDocumentLanguage } from "@/lib/law-language-preference";
import { lawDocumentLanguageScore } from "@/lib/law-language-preference";
import { normalizeOhadaUniformActKey } from "@/lib/ohada-uniform-act-catalog";
import { isOhadaInstrument } from "@/lib/ohada-commercial-companies-retrieval";

export type RegionalFrameworkMatcher = {
  id: string;
  canonicalName: string;
  titleSearchTerms: string[];
  detect: RegExp;
};

export const REGIONAL_FRAMEWORK_MATCHERS: RegionalFrameworkMatcher[] = [
  {
    id: "ohada",
    canonicalName: "OHADA Uniform Acts",
    titleSearchTerms: ["ohada", "acte uniforme", "uniform act"],
    detect: /\b(ohada|acte\s+uniforme|uniform\s+act)\b/i,
  },
  {
    id: "afcfta",
    canonicalName: "African Continental Free Trade Area (AfCFTA)",
    titleSearchTerms: ["afcfta", "african continental free trade", "continental free trade"],
    detect: /\b(afcfta|afcta|african\s+continental\s+free\s+trade)\b/i,
  },
  {
    id: "ecowas",
    canonicalName: "ECOWAS / CEDEAO",
    titleSearchTerms: ["ecowas", "cedeao", "economic community of west african", "trade liberalisation scheme"],
    detect: /\b(ecowas|cedeao|economic\s+community\s+of\s+west\s+african)\b/i,
  },
  {
    id: "eac",
    canonicalName: "East African Community (EAC)",
    titleSearchTerms: ["east african community", "eac"],
    detect: /\b(\beac\b|east\s+african\s+community)\b/i,
  },
  {
    id: "comesa",
    canonicalName: "COMESA",
    titleSearchTerms: ["comesa", "common market for eastern and southern africa"],
    detect: /\b(comesa|common\s+market\s+for\s+eastern\s+and\s+southern\s+africa)\b/i,
  },
  {
    id: "sadc",
    canonicalName: "SADC",
    titleSearchTerms: ["sadc", "southern african development community"],
    detect: /\b(sadc|southern\s+african\s+development\s+community)\b/i,
  },
  {
    id: "cemac",
    canonicalName: "CEMAC",
    titleSearchTerms: ["cemac"],
    detect: /\b(cemac|communaut[eé]\s+[eé]conomique\s+et\s+mon[eé]taire)\b/i,
  },
  {
    id: "uemoa",
    canonicalName: "UEMOA / WAEMU",
    titleSearchTerms: ["uemoa", "waemu", "union économique et monétaire"],
    detect: /\b(uemoa|waemu|union\s+[eé]conomique\s+et\s+mon[eé]taire\s+ouest\s+africaine)\b/i,
  },
  {
    id: "au",
    canonicalName: "African Union",
    titleSearchTerms: ["african union", "maputo protocol", "african charter"],
    detect: /\b(african\s+union|maputo\s+protocol|african\s+charter)\b/i,
  },
];

export type LawSourceDisplayInput = {
  title?: string | null;
  source_name?: string | null;
  language_code?: string | null;
  applies_to_all_countries?: boolean | null;
  countries?: { name?: string } | null;
};

function normalizeTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchRegionalFrameworkForLaw(
  law: LawSourceDisplayInput,
  matchers: RegionalFrameworkMatcher[] = REGIONAL_FRAMEWORK_MATCHERS
): RegionalFrameworkMatcher | null {
  const title = String(law.title ?? "");
  const titleLower = title.toLowerCase();
  const sourceLower = String(law.source_name ?? "").toLowerCase();
  const blob = `${titleLower}\n${sourceLower}`;

  for (const fw of matchers) {
    if (fw.detect.test(blob)) return fw;
    if (fw.titleSearchTerms.some((term) => titleLower.includes(term.toLowerCase()))) return fw;
  }
  return null;
}

function titleCaseToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

function bilateralPartiesFromTitle(titleLower: string, bilateralTitleTokens: string[]): string | null {
  const hits = bilateralTitleTokens
    .filter((t) => t.length >= 3 && titleLower.includes(t.toLowerCase()))
    .map((t) => titleCaseToken(t));
  const unique = Array.from(new Set(hits));
  if (unique.length >= 2) return unique.slice(0, 4).join(" · ");
  return null;
}

/** User-facing source label: framework name, bilateral parties, country, or global scope. */
export function lawSourceDisplayLabel(
  law: LawSourceDisplayInput,
  options?: {
    bilateralTitleTokens?: string[];
    matchers?: RegionalFrameworkMatcher[];
  }
): string {
  const matchers = options?.matchers ?? REGIONAL_FRAMEWORK_MATCHERS;
  const framework = matchRegionalFrameworkForLaw(law, matchers);
  if (framework) return framework.canonicalName;

  const titleLower = String(law.title ?? "").toLowerCase();
  const bilateral = options?.bilateralTitleTokens?.length
    ? bilateralPartiesFromTitle(titleLower, options.bilateralTitleTokens)
    : null;
  if (bilateral) return bilateral;

  if (law.applies_to_all_countries) return "Multiple countries";

  const sourceName = String(law.source_name ?? "").trim();
  if (sourceName) {
    const matchedFromSource = matchRegionalFrameworkForLaw({ title: sourceName, source_name: sourceName }, matchers);
    if (matchedFromSource) return matchedFromSource.canonicalName;
    if (/^(comesa|sadc|afcfta|ecowas|ohada|eac|cemac|uemoa|waemu|african union)\b/i.test(sourceName)) {
      return sourceName;
    }
  }

  if (law.countries?.name?.trim()) return law.countries.name.trim();
  return "";
}

export function lawCountryDisplayName(law: LawSourceDisplayInput): string {
  if (law.applies_to_all_countries) return "All countries";
  return law.countries?.name?.trim() || "";
}

function dedupeKeyForLaw(
  law: LawSourceDisplayInput,
  matchers: RegionalFrameworkMatcher[]
): string {
  const title = String(law.title ?? "");
  if (isOhadaInstrument(law)) {
    const actKey = normalizeOhadaUniformActKey(title);
    if (actKey) return `ohada:${actKey}`;
  }
  return normalizeTitleKey(title);
}

/** When the same instrument exists once per member state, keep the best row for RAG + citations. */
export function pickRepresentativeRegionalDuplicateLaw<T extends LawSourceDisplayInput>(
  group: T[],
  matchers: RegionalFrameworkMatcher[] = REGIONAL_FRAMEWORK_MATCHERS,
  preferredLanguage?: PreferredDocumentLanguage | null
): T {
  if (group.length <= 1) return group[0]!;
  const score = (law: T) => {
    let s = 0;
    if (law.applies_to_all_countries) s += 120;
    const fw = matchRegionalFrameworkForLaw(law, matchers);
    if (fw) s += 100;
    const sourceName = String(law.source_name ?? "").trim();
    if (sourceName && matchRegionalFrameworkForLaw({ title: sourceName, source_name: sourceName }, matchers)) {
      s += 60;
    }
    if (!law.countries?.name?.trim()) s += 20;
    if (preferredLanguage) s += lawDocumentLanguageScore(law, preferredLanguage);
    if (/\bau\s+sommaire\b/i.test(String(law.title ?? ""))) s -= 200;
    return s;
  };
  return [...group].sort((a, b) => score(b) - score(a))[0]!;
}

export function dedupeLawsByNormalizedTitle<T extends LawSourceDisplayInput & { title?: string | null }>(
  laws: T[],
  matchers: RegionalFrameworkMatcher[] = REGIONAL_FRAMEWORK_MATCHERS,
  preferredLanguage?: PreferredDocumentLanguage | null
): T[] {
  const buckets = new Map<string, T[]>();
  const noTitle: T[] = [];
  for (const law of laws) {
    const key = dedupeKeyForLaw(law, matchers);
    if (!key) {
      noTitle.push(law);
      continue;
    }
    buckets.set(key, [...(buckets.get(key) ?? []), law]);
  }
  const out: T[] = [...noTitle];
  for (const group of buckets.values()) {
    out.push(pickRepresentativeRegionalDuplicateLaw(group, matchers, preferredLanguage));
  }
  return out;
}

export function dedupeSourceCardsByTitle<
  T extends {
    title: string;
    country: string;
    retrievalScore?: number;
    usedInAnswer?: boolean;
    language_code?: string | null;
  },
>(cards: T[], preferredLanguage?: PreferredDocumentLanguage | null): T[] {
  const byTitle = new Map<string, T>();
  for (const card of cards) {
    const ohadaKey = isOhadaInstrument({ title: card.title })
      ? normalizeOhadaUniformActKey(card.title)
      : "";
    const key = ohadaKey ? `ohada:${ohadaKey}` : normalizeTitleKey(card.title);
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, card);
      continue;
    }
    const score = (c: T) => {
      let s = c.retrievalScore ?? 0;
      if (preferredLanguage) s += lawDocumentLanguageScore(c, preferredLanguage);
      if (c.usedInAnswer) s += 200;
      return s;
    };
    const base = score(card) >= score(prev) ? card : prev;
    const merged = {
      ...base,
      usedInAnswer: Boolean(prev.usedInAnswer || card.usedInAnswer),
    } as T;
    byTitle.set(key, merged);
  }
  return [...byTitle.values()];
}
