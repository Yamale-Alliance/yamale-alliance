import { isMarketplaceZip } from "@/lib/marketplace-zip-package";
import { isMarketplaceCourseItem } from "@/lib/marketplace-course";
import {
  isStandaloneVaultBrowseItem,
  type VaultDisplayProductCard,
} from "@/lib/marketplace-vault-display-cards";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";

export type VaultCatalogSectionId = "course" | "template" | "guidebook" | "series";

export const VAULT_CATALOG_SECTION_ORDER: VaultCatalogSectionId[] = [
  "course",
  "template",
  "guidebook",
  "series",
];

export function isCourseOrPackageVaultItem(p: MarketplaceBrowseItem): boolean {
  if (!isStandaloneVaultBrowseItem(p)) return false;
  if (p.type === "course" || isMarketplaceCourseItem(p)) return true;
  if (!isMarketplaceZip(p)) return false;
  const title = p.title.toLowerCase();
  return (
    title.includes("package") ||
    title.includes("accelerator") ||
    title.includes("programme") ||
    title.includes("program")
  );
}

export function classifyVaultCatalogCard(card: VaultDisplayProductCard): VaultCatalogSectionId {
  if (card.collectionHref) return "series";
  const product = card.product;
  if (isCourseOrPackageVaultItem(product)) return "course";
  if (product.type === "template") return "template";
  return "guidebook";
}

export function groupVaultCatalogSections(displayCards: VaultDisplayProductCard[]): Array<{
  id: VaultCatalogSectionId;
  cards: VaultDisplayProductCard[];
}> {
  const buckets = new Map<VaultCatalogSectionId, VaultDisplayProductCard[]>();

  for (const card of displayCards) {
    const id = classifyVaultCatalogCard(card);
    const list = buckets.get(id) ?? [];
    list.push(card);
    buckets.set(id, list);
  }

  return VAULT_CATALOG_SECTION_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
    (id) => ({
      id,
      cards: buckets.get(id)!,
    })
  );
}

export function vaultCatalogSectionLabelKey(
  id: VaultCatalogSectionId
): "course" | "template" | "guidebook" | "series" {
  if (id === "course") return "course";
  if (id === "template") return "template";
  if (id === "series") return "series";
  return "guidebook";
}
