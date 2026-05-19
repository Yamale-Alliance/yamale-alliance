import { resolveUserCountryNameToDbName } from "@/lib/country-db-name-aliases";
import { getSupabaseServer } from "@/lib/supabase/server";

let countryIdByDbName: Map<string, string> | null = null;
let categoryIdByName: Map<string, string> | null = null;
let countriesLoadPromise: Promise<void> | null = null;
let categoriesLoadPromise: Promise<void> | null = null;

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

async function ensureCountriesLoaded(): Promise<void> {
  if (countryIdByDbName) return;
  if (!countriesLoadPromise) {
    countriesLoadPromise = (async () => {
      const supabase = getSupabaseServer() as any;
      const { data, error } = await supabase.from("countries").select("id, name");
      if (error) {
        console.error("[country-resolution-cache] countries load failed:", error.message ?? error);
        countryIdByDbName = new Map();
        return;
      }
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        const name = String((row as { name?: string }).name ?? "").trim();
        const id = String((row as { id?: string }).id ?? "").trim();
        if (name && id) map.set(normalizeKey(name), id);
      }
      countryIdByDbName = map;
    })();
  }
  await countriesLoadPromise;
}

async function ensureCategoriesLoaded(): Promise<void> {
  if (categoryIdByName) return;
  if (!categoriesLoadPromise) {
    categoriesLoadPromise = (async () => {
      const supabase = getSupabaseServer() as any;
      const { data, error } = await supabase.from("categories").select("id, name");
      if (error) {
        console.error("[country-resolution-cache] categories load failed:", error.message ?? error);
        categoryIdByName = new Map();
        return;
      }
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        const name = String((row as { name?: string }).name ?? "").trim();
        const id = String((row as { id?: string }).id ?? "").trim();
        if (name && id) map.set(normalizeKey(name), id);
      }
      categoryIdByName = map;
    })();
  }
  await categoriesLoadPromise;
}

/** Resolve country UUID from display/alias name (~0ms after warm load). */
export async function resolveCountryIdCached(userCountryName: string): Promise<string | null> {
  await ensureCountriesLoaded();
  const dbName = resolveUserCountryNameToDbName(userCountryName);
  return countryIdByDbName!.get(normalizeKey(dbName)) ?? null;
}

/** Exact category name match from preloaded map; returns null if not found (caller may fuzzy-query). */
export async function resolveCategoryIdCached(categoryName: string): Promise<string | null> {
  await ensureCategoriesLoaded();
  return categoryIdByName!.get(normalizeKey(categoryName)) ?? null;
}

export function clearCountryResolutionCache(): void {
  countryIdByDbName = null;
  categoryIdByName = null;
  countriesLoadPromise = null;
  categoriesLoadPromise = null;
}
