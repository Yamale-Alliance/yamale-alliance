import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeLawDocumentLanguageCode,
  type LawDocumentLanguageCode,
} from "@/lib/law-document-language";

export type MarketplaceItemFileRow = {
  id: string;
  marketplace_item_id: string;
  language_code: string;
  file_path: string;
  file_name: string;
  file_format: string;
  created_at?: string;
};

export type MarketplaceItemFileInput = {
  language_code: string;
  file_path: string;
  file_name: string;
  file_format: string;
};

export type MarketplaceLanguageFileDraft = {
  id?: string;
  language_code: string;
  file_path?: string | null;
  file_name?: string | null;
  file_format?: string | null;
  pending?: {
    path: string;
    file_name: string;
    file_format: string;
  };
  removed?: boolean;
};

const TABLE = "marketplace_item_files";

const LANGUAGE_SORT_ORDER: LawDocumentLanguageCode[] = [
  "en",
  "fr",
  "pt",
  "ar",
  "sw",
  "other",
];

function languageSortKey(code: string): number {
  const idx = LANGUAGE_SORT_ORDER.indexOf(code as LawDocumentLanguageCode);
  return idx >= 0 ? idx : 999;
}

export function sortMarketplaceLanguageCodes(codes: string[]): string[] {
  return [...new Set(codes.filter(Boolean))].sort(
    (a, b) => languageSortKey(a) - languageSortKey(b) || a.localeCompare(b)
  );
}

/** DRC Extractive Industry Subcontractor Pack — display EN+FR (zip includes both; DB may list EN only). */
export function isDrcExtractiveSubcontractorPack(item: {
  title?: string | null;
  slug?: string | null;
}): boolean {
  const title = (item.title ?? "").trim().toLowerCase();
  const slug = (item.slug ?? "").trim().toLowerCase();
  if (
    slug.includes("drc") &&
    slug.includes("extractive") &&
    slug.includes("subcontractor")
  ) {
    return true;
  }
  return (
    title.includes("drc") &&
    title.includes("extractive") &&
    title.includes("subcontractor")
  );
}

export function resolveMarketplaceDisplayLanguageCodes(
  item: { title?: string | null; slug?: string | null },
  codesFromDb: string[]
): string[] {
  if (isDrcExtractiveSubcontractorPack(item)) {
    return sortMarketplaceLanguageCodes(["en", "fr"]);
  }
  return codesFromDb.length > 0 ? sortMarketplaceLanguageCodes(codesFromDb) : [];
}

export function pickPrimaryMarketplaceItemFile(
  files: MarketplaceItemFileRow[]
): MarketplaceItemFileRow | null {
  if (files.length === 0) return null;
  const en = files.find((f) => f.language_code === "en");
  if (en) return en;
  return [...files].sort(
    (a, b) => languageSortKey(a.language_code) - languageSortKey(b.language_code)
  )[0];
}

export function parseMarketplaceItemFilesInput(raw: unknown): MarketplaceItemFileInput[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];
  const out: MarketplaceItemFileInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const language_code = normalizeLawDocumentLanguageCode(
      typeof row.language_code === "string" ? row.language_code : null
    );
    const file_path = typeof row.file_path === "string" ? row.file_path.trim() : "";
    const file_name = typeof row.file_name === "string" ? row.file_name.trim() : "";
    const file_format = typeof row.file_format === "string" ? row.file_format.trim() : "";
    if (!language_code || !file_path || !file_name || !file_format) continue;
    if (seen.has(language_code)) continue;
    seen.add(language_code);
    out.push({ language_code, file_path, file_name, file_format });
  }
  return out;
}

export function buildLanguageFilesPayload(
  drafts: MarketplaceLanguageFileDraft[]
): MarketplaceItemFileInput[] {
  return drafts
    .filter((d) => !d.removed && (d.pending?.path || d.file_path))
    .map((d) => ({
      language_code: d.language_code,
      file_path: d.pending?.path ?? String(d.file_path),
      file_name: d.pending?.file_name ?? String(d.file_name),
      file_format: d.pending?.file_format ?? String(d.file_format),
    }))
    .filter((d) => normalizeLawDocumentLanguageCode(d.language_code) && d.file_path.trim());
}

export function draftsFromMarketplaceItemFiles(
  rows: MarketplaceItemFileRow[]
): MarketplaceLanguageFileDraft[] {
  if (rows.length === 0) return [{ language_code: "en" }];
  return sortMarketplaceLanguageCodes(rows.map((r) => r.language_code)).map((code) => {
    const row = rows.find((r) => r.language_code === code)!;
    return {
      id: row.id,
      language_code: row.language_code,
      file_path: row.file_path,
      file_name: row.file_name,
      file_format: row.file_format,
    };
  });
}

export function defaultMarketplaceLanguageFileDrafts(): MarketplaceLanguageFileDraft[] {
  return [{ language_code: "en" }];
}

export function legacyFieldsFromMarketplaceFiles(
  files: MarketplaceItemFileInput[]
): {
  file_path: string | null;
  file_name: string | null;
  file_format: string | null;
} {
  const primary = pickPrimaryMarketplaceItemFile(
    files.map((f, i) => ({
      id: `draft-${i}`,
      marketplace_item_id: "",
      language_code: f.language_code,
      file_path: f.file_path,
      file_name: f.file_name,
      file_format: f.file_format,
    }))
  );
  if (!primary) {
    return { file_path: null, file_name: null, file_format: null };
  }
  return {
    file_path: primary.file_path,
    file_name: primary.file_name,
    file_format: primary.file_format,
  };
}

export function isMarketplaceItemFilesTableMissing(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("marketplace_item_files") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function listMarketplaceItemFiles(
  supabase: SupabaseClient,
  itemId: string
): Promise<MarketplaceItemFileRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, marketplace_item_id, language_code, file_path, file_name, file_format, created_at")
    .eq("marketplace_item_id", itemId)
    .order("language_code", { ascending: true });

  if (error) {
    if (isMarketplaceItemFilesTableMissing(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as MarketplaceItemFileRow[];
}

export async function listMarketplaceItemFilesByItemIds(
  supabase: SupabaseClient,
  itemIds: string[]
): Promise<Map<string, MarketplaceItemFileRow[]>> {
  const out = new Map<string, MarketplaceItemFileRow[]>();
  const unique = Array.from(new Set(itemIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const { data, error } = await supabase
    .from(TABLE)
    .select("id, marketplace_item_id, language_code, file_path, file_name, file_format, created_at")
    .in("marketplace_item_id", unique)
    .order("language_code", { ascending: true });

  if (error) {
    if (isMarketplaceItemFilesTableMissing(error.message)) return out;
    throw new Error(error.message);
  }

  for (const row of (data ?? []) as MarketplaceItemFileRow[]) {
    const list = out.get(row.marketplace_item_id) ?? [];
    list.push(row);
    out.set(row.marketplace_item_id, list);
  }
  return out;
}

export async function syncMarketplaceItemFiles(
  supabase: SupabaseClient,
  itemId: string,
  files: MarketplaceItemFileInput[] | null | undefined
): Promise<MarketplaceItemFileRow[]> {
  if (files === null || files === undefined) return listMarketplaceItemFiles(supabase, itemId);

  const normalized = parseMarketplaceItemFilesInput(files) ?? [];
  const existing = await listMarketplaceItemFiles(supabase, itemId);
  const nextCodes = new Set(normalized.map((f) => f.language_code));

  for (const row of existing) {
    if (!nextCodes.has(row.language_code)) {
      const { error } = await supabase.from(TABLE).delete().eq("id", row.id);
      if (error && !isMarketplaceItemFilesTableMissing(error.message)) {
        throw new Error(error.message);
      }
    }
  }

  for (const file of normalized) {
    const { error } = await supabase.from(TABLE).upsert(
      {
        marketplace_item_id: itemId,
        language_code: file.language_code,
        file_path: file.file_path,
        file_name: file.file_name,
        file_format: file.file_format,
      },
      { onConflict: "marketplace_item_id,language_code" }
    );
    if (error) {
      if (isMarketplaceItemFilesTableMissing(error.message)) return [];
      throw new Error(error.message);
    }
  }

  return listMarketplaceItemFiles(supabase, itemId);
}

export async function resolveMarketplaceItemFileForAccess(
  supabase: SupabaseClient,
  itemId: string,
  languageCode?: string | null,
  legacy?: {
    file_path: string | null;
    file_name: string | null;
    file_format: string | null;
  }
): Promise<{
  file_path: string;
  file_name: string | null;
  file_format: string | null;
  language_code: string | null;
} | null> {
  const files = await listMarketplaceItemFiles(supabase, itemId);
  if (files.length > 0) {
    const requested = normalizeLawDocumentLanguageCode(languageCode);
    const match = requested ? files.find((f) => f.language_code === requested) : null;
    const picked = match ?? pickPrimaryMarketplaceItemFile(files);
    if (!picked?.file_path?.trim()) return null;
    return {
      file_path: picked.file_path,
      file_name: picked.file_name,
      file_format: picked.file_format,
      language_code: picked.language_code,
    };
  }

  if (legacy?.file_path?.trim()) {
    return {
      file_path: legacy.file_path,
      file_name: legacy.file_name,
      file_format: legacy.file_format,
      language_code: null,
    };
  }
  return null;
}

export function publicLanguageFileMeta(files: MarketplaceItemFileRow[]): Array<{
  language_code: string;
  file_name: string;
  file_format: string;
}> {
  return sortMarketplaceLanguageCodes(files.map((f) => f.language_code)).map((code) => {
    const row = files.find((f) => f.language_code === code)!;
    return {
      language_code: row.language_code,
      file_name: row.file_name,
      file_format: row.file_format,
    };
  });
}
