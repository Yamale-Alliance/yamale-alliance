import { detectCountryAliasFromQueryText } from "@/lib/country-db-name-aliases";
import {
  getOfficialSource,
  inferOfficialSourceCategoryFromQuery,
  normalizeOfficialSourceCountryName,
  type OfficialSourceCategory,
} from "@/lib/official-sources";

export function isOfficialSourceLookupQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 12 || q.length > 500) return false;

  const lookupIntent =
    /\bwhere\s+(can\s+i\s+)?verify\b/.test(q) ||
    /\bofficial\s+source\s+for\b/.test(q) ||
    /\bgovernment\s+website\s+for\b/.test(q) ||
    /\bwhere\s+to\s+register\b/.test(q) ||
    /\bwhere\s+do\s+i\s+(register|file|pay|declare)\b/.test(q) ||
    /\bwhich\s+(government\s+)?(agency|authority|portal|website)\b/.test(q) ||
    /\bofficial\s+(portal|website|agency)\s+for\b/.test(q) ||
    /\bwhere\s+to\s+(find|check|confirm)\s+.{0,40}\b(tax|labou?r|customs|registration)\b/.test(q);

  if (!lookupIntent) return false;

  // Substantive legal analysis disguised as a source lookup — keep normal RAG.
  if (/\b(article|section|clause)\s+\d+/i.test(raw)) return false;
  if (/\bwhat\s+(are|is)\s+the\s+(requirements?|penalt|fine|sentence)\b/.test(q)) return false;

  return true;
}

export function parseOfficialSourceLookupIntent(
  query: string,
  countryHint?: string | null
): { country: string; category: OfficialSourceCategory } | null {
  const category = inferOfficialSourceCategoryFromQuery(query);
  if (!category) return null;

  const country =
    countryHint?.trim() || detectCountryAliasFromQueryText(query);
  if (!country) return null;

  return {
    country: normalizeOfficialSourceCountryName(country),
    category,
  };
}

export async function buildOfficialSourceLookupResponse(
  country: string,
  category: OfficialSourceCategory
): Promise<{ content: string; found: boolean }> {
  const row = await getOfficialSource(country, category);
  if (!row) {
    return {
      found: false,
      content:
        `I do not have an official ${category.toLowerCase()} source on file for ${country} in the Yamalé reference list. ` +
        `Try specifying another category (tax, labour, business registration, customs, investment, or official gazette), or ask a substantive legal question and I will cite library instruments.`,
    };
  }

  const notes = row.notes?.trim() ? `\n\n${row.notes.trim()}` : "";
  const urlPart = row.url
    ? `: [${row.agency_name}](${row.url})`
    : `: ${row.agency_name} (no reliable online portal listed — verify through official government channels)`;

  return {
    found: true,
    content: `For ${category.toLowerCase()} in ${country}, the official source is${urlPart}${notes}`,
  };
}
