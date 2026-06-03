import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/content-slug";
import { marketplaceItemPublicPath } from "@/lib/marketplace-public-url";
import { resolveMarketplaceForPublicPage } from "@/lib/marketplace-resolve-server";
import { createPageMetadata } from "@/lib/site-seo";
import MarketplaceItemPageClient from "./MarketplaceItemPageClient";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const meta = await resolveMarketplaceForPublicPage(id);
  if (!meta) {
    return createPageMetadata({
      title: "Item not found",
      description: "This Yamalé Vault item could not be found.",
      path: "/marketplace",
      noIndex: true,
    });
  }

  const path = marketplaceItemPublicPath(meta.slug);
  const description =
    meta.description?.trim() ||
    `${meta.title} — books, courses, and legal resources in The Yamalé Vault.`;

  return createPageMetadata({
    title: meta.title,
    description,
    path,
    keywords: ["Yamalé Vault", "legal resources", meta.title],
  });
}

export default async function MarketplaceItemPage({ params }: PageProps) {
  const { id: slugOrId } = await params;
  const meta = await resolveMarketplaceForPublicPage(slugOrId);
  if (!meta) notFound();

  if (isUuid(slugOrId) && meta.slug && slugOrId.toLowerCase() !== meta.slug.toLowerCase()) {
    redirect(marketplaceItemPublicPath(meta.slug));
  }

  return <MarketplaceItemPageClient slugOrId={meta.slug || meta.id} />;
}
