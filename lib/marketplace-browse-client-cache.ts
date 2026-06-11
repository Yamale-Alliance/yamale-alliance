import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";

const STORAGE_KEY = "yamale-vault-browse-v1";
const TTL_MS = 5 * 60 * 1000;

type VaultBrowseClientCache = {
  savedAt: number;
  items: MarketplaceBrowseItem[];
  advisoryWorkspacePreview: boolean;
  vaultSeries: VaultSeriesRecord[];
};

export function readVaultBrowseClientCache(): VaultBrowseClientCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultBrowseClientCache;
    if (!parsed?.savedAt || !Array.isArray(parsed.items)) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVaultBrowseClientCache(payload: {
  items: MarketplaceBrowseItem[];
  advisoryWorkspacePreview: boolean;
  vaultSeries: VaultSeriesRecord[];
}): void {
  if (typeof window === "undefined") return;
  try {
    const entry: VaultBrowseClientCache = {
      savedAt: Date.now(),
      items: payload.items,
      advisoryWorkspacePreview: payload.advisoryWorkspacePreview,
      vaultSeries: payload.vaultSeries,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota or private mode — ignore.
  }
}
