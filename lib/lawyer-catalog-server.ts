import {
  canonicalExpertiseLabel,
  dedupeExpertiseSegments,
  expertiseSegmentKey,
  parseExpertiseSegments,
  STANDARD_PRACTICE_AREAS,
} from "@/lib/lawyer-expertise";
import {
  canonicalLawyerLanguage,
  collectLawyerLanguages,
  lawyerLanguageKey,
  STANDARD_LAWYER_LANGUAGES,
} from "@/lib/lawyer-languages";
import { fallbackLawyerCatalog, type LawyerCatalogSnapshot } from "@/lib/lawyer-catalog";
import { getSupabaseServer } from "@/lib/supabase/server";

export type { LawyerCatalogSnapshot } from "@/lib/lawyer-catalog";
export { fallbackLawyerCatalog };

function isMissingTableError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table")
  );
}

function normalizeCatalogName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export type LawyerCatalogRow = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  usageCount: number;
};

export async function fetchLawyerCatalogSnapshot(): Promise<LawyerCatalogSnapshot> {
  try {
    const supabase = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const [areasRes, languagesRes] = await Promise.all([
      db.from("lawyer_practice_areas").select("name").order("sort_order").order("name"),
      db.from("lawyer_language_options").select("name").order("sort_order").order("name"),
    ]);

    if (areasRes.error && isMissingTableError(areasRes.error.message)) {
      return fallbackLawyerCatalog();
    }
    if (languagesRes.error && isMissingTableError(languagesRes.error.message)) {
      return fallbackLawyerCatalog();
    }
    if (areasRes.error) throw areasRes.error;
    if (languagesRes.error) throw languagesRes.error;

    const practiceAreas = ((areasRes.data ?? []) as Array<{ name: string }>)
      .map((row) => canonicalExpertiseLabel(row.name))
      .filter(Boolean);
    const languages = ((languagesRes.data ?? []) as Array<{ name: string }>)
      .map((row) => canonicalLawyerLanguage(row.name))
      .filter(Boolean);

    if (practiceAreas.length === 0 && languages.length === 0) {
      return fallbackLawyerCatalog();
    }

    return {
      practiceAreas:
        practiceAreas.length > 0 ? practiceAreas : [...STANDARD_PRACTICE_AREAS],
      languages: languages.length > 0 ? languages : [...STANDARD_LAWYER_LANGUAGES],
    };
  } catch {
    return fallbackLawyerCatalog();
  }
}

export async function fetchLawyerExpertiseRows(): Promise<Array<{ id: string; expertise: string | null }>> {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("lawyers").select("id, expertise");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; expertise: string | null }>;
}

export async function fetchLawyerLanguageRows(): Promise<
  Array<{ id: string; primary_language: string | null; other_languages: string | null }>
> {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("lawyers")
    .select("id, primary_language, other_languages");
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    primary_language: string | null;
    other_languages: string | null;
  }>;
}

export function countLawyersUsingPracticeArea(
  lawyers: Array<{ expertise: string | null }>,
  areaName: string
): number {
  const wantKey = expertiseSegmentKey(areaName);
  return lawyers.filter((lawyer) =>
    dedupeExpertiseSegments(parseExpertiseSegments(lawyer.expertise ?? "")).some(
      (segment) => expertiseSegmentKey(segment) === wantKey
    )
  ).length;
}

export function countLawyersUsingLanguage(
  lawyers: Array<{ primary_language: string | null; other_languages: string | null }>,
  languageName: string
): number {
  const wantKey = lawyerLanguageKey(languageName);
  return lawyers.filter((lawyer) =>
    collectLawyerLanguages(lawyer.primary_language, lawyer.other_languages).some(
      (language) => lawyerLanguageKey(language) === wantKey
    )
  ).length;
}

export async function fetchAdminLawyerPracticeAreas(): Promise<LawyerCatalogRow[]> {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [areasRes, lawyers] = await Promise.all([
    db
      .from("lawyer_practice_areas")
      .select("id,name,sort_order,created_at")
      .order("sort_order")
      .order("name"),
    fetchLawyerExpertiseRows(),
  ]);

  if (areasRes.error) throw areasRes.error;

  return ((areasRes.data ?? []) as Array<Omit<LawyerCatalogRow, "usageCount">>).map((row) => ({
    ...row,
    name: canonicalExpertiseLabel(row.name),
    usageCount: countLawyersUsingPracticeArea(lawyers, row.name),
  }));
}

export async function fetchAdminLawyerLanguages(): Promise<LawyerCatalogRow[]> {
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [languagesRes, lawyers] = await Promise.all([
    db
      .from("lawyer_language_options")
      .select("id,name,sort_order,created_at")
      .order("sort_order")
      .order("name"),
    fetchLawyerLanguageRows(),
  ]);

  if (languagesRes.error) throw languagesRes.error;

  return ((languagesRes.data ?? []) as Array<Omit<LawyerCatalogRow, "usageCount">>).map((row) => ({
    ...row,
    name: canonicalLawyerLanguage(row.name),
    usageCount: countLawyersUsingLanguage(lawyers, row.name),
  }));
}

export async function replacePracticeAreaInLawyers(
  oldName: string,
  newName: string
): Promise<void> {
  const oldKey = expertiseSegmentKey(oldName);
  const newLabel = canonicalExpertiseLabel(newName);
  const lawyers = await fetchLawyerExpertiseRows();
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  for (const lawyer of lawyers) {
    const segments = dedupeExpertiseSegments(parseExpertiseSegments(lawyer.expertise ?? ""));
    if (!segments.some((segment) => expertiseSegmentKey(segment) === oldKey)) continue;
    const next = dedupeExpertiseSegments(
      segments.map((segment) =>
        expertiseSegmentKey(segment) === oldKey ? newLabel : segment
      )
    ).join(", ");
    await db.from("lawyers").update({ expertise: next }).eq("id", lawyer.id);
  }
}

export async function replaceLanguageInLawyers(oldName: string, newName: string): Promise<void> {
  const oldKey = lawyerLanguageKey(oldName);
  const newLabel = canonicalLawyerLanguage(newName);
  const lawyers = await fetchLawyerLanguageRows();
  const supabase = getSupabaseServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  for (const lawyer of lawyers) {
    const languages = collectLawyerLanguages(lawyer.primary_language, lawyer.other_languages);
    if (!languages.some((language) => lawyerLanguageKey(language) === oldKey)) continue;
    const nextLanguages = dedupeLawyerLanguagesFromList(
      languages.map((language) =>
        lawyerLanguageKey(language) === oldKey ? newLabel : language
      )
    );
    const [primary, ...rest] = nextLanguages;
    await db
      .from("lawyers")
      .update({
        primary_language: primary ?? null,
        other_languages: rest.length > 0 ? rest.join(", ") : null,
      })
      .eq("id", lawyer.id);
  }
}

function dedupeLawyerLanguagesFromList(languages: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const language of languages) {
    const label = canonicalLawyerLanguage(language);
    const key = lawyerLanguageKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function validateCatalogName(raw: string): string | null {
  const name = normalizeCatalogName(raw);
  if (name.length < 2) return null;
  if (name.length > 120) return null;
  return name;
}

export { normalizeCatalogName };
