import { auth } from "@clerk/nextjs/server";
import { MarketplaceCoverPreloads } from "@/components/marketplace/MarketplaceCoverPreloads";
import { fetchMarketplaceBrowsePayload } from "@/lib/marketplace-browse-data";
import { MarketplacePageClient } from "./MarketplacePageClient";

export default async function MarketplacePage() {
  const { userId } = await auth();
  const initialPayload = await fetchMarketplaceBrowsePayload(userId);

  return (
    <>
      <MarketplaceCoverPreloads
        items={initialPayload.items}
        vaultSeries={initialPayload.vaultSeries}
      />
      <MarketplacePageClient initialPayload={initialPayload} />
    </>
  );
}
