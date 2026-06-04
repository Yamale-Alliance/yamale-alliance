/** Yamalé Vault browse taxonomy: paid format types + collection series. */

import { AFRICAN_COUNTRY_ISO2, type VaultFocusCountry } from "@/lib/marketplace-vault-country";
import {
  VAULT_SUBCATEGORIES_FALLBACK,
  type VaultSubcategoryEntry,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories-fallback";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";
import { mergeVaultSeriesRecords, vaultSeriesCoverUrl } from "@/lib/marketplace-vault-series";

export type { VaultSubcategoryEntry, VaultSubcategoryId };
export { VAULT_SUBCATEGORIES_FALLBACK };

export const VAULT_BROWSE_FREE = "free" as const;
export const VAULT_BROWSE_SERIES = "series" as const;

/** @deprecated — use merged registry; kept for imports that listed static series only. */
export const VAULT_SUBCATEGORIES = VAULT_SUBCATEGORIES_FALLBACK;

let seriesOverlay: VaultSeriesRecord[] | null = null;

/** Client/server: apply series list from API (DB merged with fallbacks). */
export function setVaultSeriesRegistry(records: VaultSeriesRecord[]) {
  seriesOverlay = records;
}

export function listVaultSeries(): VaultSeriesRecord[] {
  return seriesOverlay ?? mergeVaultSeriesRecords([]);
}

const registryMap = () => new Map(listVaultSeries().map((s) => [s.id, s]));

export function isFreeVaultItem(priceCents: number): boolean {
  return Number(priceCents) === 0;
}

export function isKnownVaultSeriesId(id: string): boolean {
  return registryMap().has(id.trim());
}

export function isValidVaultSubcategory(id: string | null | undefined): id is VaultSubcategoryId {
  if (!id?.trim()) return false;
  return isKnownVaultSeriesId(id);
}

export function normalizeVaultSubcategory(raw: string | null | undefined): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  return t && isKnownVaultSeriesId(t) ? t : null;
}

export function vaultSubcategoryMeta(id: string | null | undefined): VaultSeriesRecord | null {
  const t = typeof id === "string" ? id.trim() : "";
  if (!t) return null;
  return registryMap().get(t) ?? null;
}

export function isPaidVaultSubcategory(id: string | null | undefined): boolean {
  return vaultSubcategoryMeta(id)?.paid === true;
}

export function isFreeVaultSubcategory(id: string | null | undefined): boolean {
  const meta = vaultSubcategoryMeta(id);
  return Boolean(meta && !meta.paid);
}

export function labelForVaultSubcategory(id: string | null | undefined): string | null {
  return vaultSubcategoryMeta(id)?.label ?? null;
}

export function vaultSeriesCoverImagePath(id: string | null | undefined): string | null {
  return vaultSeriesCoverUrl(vaultSubcategoryMeta(id));
}

export function vaultSeriesUsesPerCountryCovers(id: string | null | undefined): boolean {
  return Boolean(vaultSubcategoryMeta(id)?.perCountryItemCovers);
}

export function vaultSeriesSuggestedItemPriceCents(id: string | null | undefined): number | null {
  const cents = vaultSubcategoryMeta(id)?.suggestedItemPriceCents;
  return typeof cents === "number" && cents > 0 ? cents : null;
}

export function quickInvestmentGuideCountryCoverPath(country: VaultFocusCountry): string {
  const iso = AFRICAN_COUNTRY_ISO2[country];
  return `/vault/quick-investment-guide/countries/${iso}.jpg`;
}

export function seriesBundlePriceCents(id: string | null | undefined): number | null {
  const meta = vaultSubcategoryMeta(id);
  if (!meta?.paid) return null;
  const cents = meta.series_bundle_price_cents;
  return typeof cents === "number" && cents > 0 ? cents : null;
}

export function parseVaultSeriesParam(seriesParam: string | null): string | null {
  if (!seriesParam?.trim()) return null;
  return normalizeVaultSubcategory(seriesParam);
}

export function parseVaultFreeSeriesParam(seriesParam: string | null): string | null {
  const parsed = parseVaultSeriesParam(seriesParam);
  return parsed && isFreeVaultSubcategory(parsed) ? parsed : null;
}

export function shouldGroupVaultItem(item: {
  price_cents: number;
  vault_subcategory?: string | null;
}): boolean {
  const sub = item.vault_subcategory?.trim();
  if (!sub || !isKnownVaultSeriesId(sub)) return false;
  if (isPaidVaultSubcategory(sub)) return true;
  return isFreeVaultItem(item.price_cents);
}

export function resolveVaultSubcategoryForSave(priceCents: number, raw: unknown): string | null {
  const sub = normalizeVaultSubcategory(typeof raw === "string" ? raw : null);
  if (!sub) return null;
  if (isPaidVaultSubcategory(sub)) return sub;
  if (isFreeVaultItem(priceCents)) return sub;
  return null;
}

export const PAID_VAULT_SUBCATEGORIES = () => listVaultSeries().filter((s) => s.paid);

export function compareVaultSeriesOrder(a: string, b: string): number {
  const ma = vaultSubcategoryMeta(a);
  const mb = vaultSubcategoryMeta(b);
  if (Boolean(ma?.paid) !== Boolean(mb?.paid)) {
    return ma?.paid ? -1 : 1;
  }
  return (ma?.sort_order ?? 999) - (mb?.sort_order ?? 999);
}

export function shouldCollapseVaultSeries(
  browseKind: "all" | "type" | "free",
  freeSubcategory: string | null
): boolean {
  if (browseKind === "all" || browseKind === "type") return true;
  if (browseKind === "free" && !freeSubcategory) return true;
  return false;
}

/** @deprecated Use VAULT_SUBCATEGORIES_FALLBACK */
export const VAULT_FREE_SUBCATEGORIES = VAULT_SUBCATEGORIES_FALLBACK.filter((s) => !s.paid);
