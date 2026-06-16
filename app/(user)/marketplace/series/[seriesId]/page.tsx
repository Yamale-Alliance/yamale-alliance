import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { MarketplaceCoverPreloads } from "@/components/marketplace/MarketplaceCoverPreloads";
import { fetchMarketplaceBrowsePayload } from "@/lib/marketplace-browse-data";
import { filterSeriesMembers } from "@/lib/marketplace-vault-series-display";
import { VaultSeriesPageClient } from "./VaultSeriesPageClient";

type VaultSeriesPageProps = {
  params: Promise<{ seriesId: string }>;
  searchParams: Promise<{ country?: string }>;
};

export default async function VaultSeriesPage({ params, searchParams }: VaultSeriesPageProps) {
  const { seriesId } = await params;
  const { country } = await searchParams;
  const focusCountry = country?.trim() || null;
  const decodedSeriesId = decodeURIComponent(seriesId).trim();

  if (!decodedSeriesId) notFound();

  const { userId } = await auth();
  const initialPayload = await fetchMarketplaceBrowsePayload(userId);
  const members = filterSeriesMembers(initialPayload.items, decodedSeriesId, focusCountry);

  if (members.length === 0) notFound();

  return (
    <>
      <MarketplaceCoverPreloads items={members} vaultSeries={initialPayload.vaultSeries} />
      <VaultSeriesPageClient
        seriesId={decodedSeriesId}
        focusCountry={focusCountry}
        initialPayload={initialPayload}
      />
    </>
  );
}
