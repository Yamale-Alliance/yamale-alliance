import { sortMarketplaceLanguageCodes } from "@/lib/marketplace-item-files";
import { isMarketplaceCourseItem } from "@/lib/marketplace-course";
import {
  compareVaultSeriesOrder,
  isVaultSeriesMemberItem,
  shouldCollapseVaultSeries,
  type VaultSubcategoryId,
} from "@/lib/marketplace-vault-categories";
import {
  parseVaultSeriesGroupKey,
  resolveSeriesCollectionLabel,
  vaultSeriesCoverFromList,
  vaultSeriesGroupKey,
  vaultSeriesPageHref,
  vaultSeriesRecordFromList,
} from "@/lib/marketplace-vault-series-display";
import type { MarketplaceBrowseItem } from "@/lib/marketplace-browse-data";
import type { VaultSeriesRecord } from "@/lib/marketplace-vault-series";

export type VaultDisplayProductCard = {
  product: MarketplaceBrowseItem;
  collectionHref?: string;
  collectionCount?: number;
  collectionLabel?: string;
  seriesKey?: string;
  seriesFocusCountry?: string | null;
};

export type VaultBrowseContext = {
  kind: "all" | "free" | "type" | "series";
  type?: "book" | "course" | "template" | "guide";
  freeSubcategory?: string | null;
};

export type VaultDisplayCardMode = "default" | "standalone" | "series-only";

export function isStandaloneVaultBrowseItem(item: {
  vault_subcategory?: string | null;
}): boolean {
  return !isVaultSeriesMemberItem(item);
}

function buildSeriesCardsFromMembers(
  membersByKey: Map<string, MarketplaceBrowseItem[]>,
  seriesLabel: string,
  vaultSeries: VaultSeriesRecord[]
): VaultDisplayProductCard[] {
  return Array.from(membersByKey.entries())
    .sort(([a], [b]) => {
      const pa = parseVaultSeriesGroupKey(a);
      const pb = parseVaultSeriesGroupKey(b);
      const order = compareVaultSeriesOrder(pa.subcategory, pb.subcategory);
      if (order !== 0) return order;
      return a.localeCompare(b);
    })
    .map(([groupKey, members]) => {
      const { subcategory, focusCountry } = parseVaultSeriesGroupKey(groupKey);
      const meta = vaultSeriesRecordFromList(subcategory, vaultSeries);
      const seriesCover = vaultSeriesCoverFromList(subcategory, vaultSeries);
      const base = members[0];
      const label = resolveSeriesCollectionLabel(
        subcategory,
        members,
        focusCountry,
        seriesLabel,
        vaultSeries
      );
      const seriesLanguageCodes = sortMarketplaceLanguageCodes(
        members.flatMap((m) => m.language_codes ?? [])
      );
      const allowMemberCoverFallback = !meta?.perCountryItemCovers;
      const coverProduct = {
        ...base,
        image_url:
          seriesCover ??
          (allowMemberCoverFallback
            ? (members.find((m) => m.image_url)?.image_url ?? base.image_url)
            : null),
        title: label,
        description: meta?.blurb ?? meta?.description ?? base.description ?? null,
        language_codes: seriesLanguageCodes,
      };
      return {
        product: coverProduct,
        collectionLabel: label,
        collectionCount: members.length,
        seriesKey: groupKey,
        seriesFocusCountry: focusCountry,
        collectionHref: vaultSeriesPageHref(subcategory),
      };
    });
}

function groupSeriesMembers(
  products: MarketplaceBrowseItem[]
): Map<string, MarketplaceBrowseItem[]> {
  const membersByKey = new Map<string, MarketplaceBrowseItem[]>();
  for (const product of products) {
    const key = vaultSeriesGroupKey(product);
    if (!key) continue;
    const members = membersByKey.get(key) ?? [];
    members.push(product);
    membersByKey.set(key, members);
  }
  return membersByKey;
}

export function buildVaultDisplayCards(
  sortedProducts: MarketplaceBrowseItem[],
  context: VaultBrowseContext,
  seriesLabel: string,
  mode: VaultDisplayCardMode = "default",
  vaultSeries: VaultSeriesRecord[] = []
): {
  displayCards: VaultDisplayProductCard[];
  seriesMembersByKey: Map<string, MarketplaceBrowseItem[]>;
} {
  if (mode === "standalone") {
    const standalone = sortedProducts.filter((product) => isStandaloneVaultBrowseItem(product));
    return {
      displayCards: standalone.map((product) => ({ product })),
      seriesMembersByKey: new Map(),
    };
  }

  if (mode === "series-only") {
    const membersByKey = groupSeriesMembers(sortedProducts);
    return {
      displayCards: buildSeriesCardsFromMembers(membersByKey, seriesLabel, vaultSeries),
      seriesMembersByKey: membersByKey,
    };
  }

  const freeSubcategory = context.kind === "free" ? (context.freeSubcategory ?? null) : null;
  const collapseSeries = shouldCollapseVaultSeries(
    context.kind === "free" ? "free" : context.kind === "type" ? "type" : context.kind === "series" ? "all" : "all",
    freeSubcategory
  );

  if (!collapseSeries) {
    return {
      displayCards: sortedProducts.map((product) => ({ product })),
      seriesMembersByKey: new Map(),
    };
  }

  const membersByKey = new Map<string, MarketplaceBrowseItem[]>();
  const regularProducts: MarketplaceBrowseItem[] = [];
  const featuredProducts: MarketplaceBrowseItem[] = [];

  for (const product of sortedProducts) {
    if (isMarketplaceCourseItem(product)) {
      featuredProducts.push(product);
      continue;
    }
    const groupKey = vaultSeriesGroupKey(product);
    if (groupKey) {
      const members = membersByKey.get(groupKey) ?? [];
      members.push(product);
      membersByKey.set(groupKey, members);
    } else {
      regularProducts.push(product);
    }
  }

  return {
    displayCards: [
      ...featuredProducts.map((product) => ({ product })),
      ...buildSeriesCardsFromMembers(membersByKey, seriesLabel, vaultSeries),
      ...regularProducts.map((product) => ({ product })),
    ],
    seriesMembersByKey: membersByKey,
  };
}

export type { VaultSubcategoryId };
