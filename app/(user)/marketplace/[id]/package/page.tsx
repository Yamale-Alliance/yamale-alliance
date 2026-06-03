import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/content-slug";
import { marketplacePackagePublicPath } from "@/lib/marketplace-public-url";
import { resolveMarketplaceForPublicPage } from "@/lib/marketplace-resolve-server";
import { createPageMetadata } from "@/lib/site-seo";
import MarketplacePackagePageClient from "./MarketplacePackagePageClient";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const meta = await resolveMarketplaceForPublicPage(id);
  if (!meta) {
    return createPageMetadata({
      title: "Package not found",
      description: "This Yamalé Vault package could not be found.",
      path: "/marketplace",
      noIndex: true,
    });
  }

  const path = marketplacePackagePublicPath(meta.slug);
  const description =
    meta.description?.trim() ||
    `${meta.title} — package offer in The Yamalé Vault.`;

  return createPageMetadata({
    title: `${meta.title} — Package`,
    description,
    path,
    keywords: ["Yamalé Vault", "legal package", meta.title],
  });
}

export default async function MarketplacePackagePage({ params }: PageProps) {
  const { id: slugOrId } = await params;
  const meta = await resolveMarketplaceForPublicPage(slugOrId);
  if (!meta) notFound();

  if (isUuid(slugOrId) && meta.slug && slugOrId.toLowerCase() !== meta.slug.toLowerCase()) {
    redirect(marketplacePackagePublicPath(meta.slug));
  }

  return <MarketplacePackagePageClient slugOrId={meta.slug || meta.id} />;
}
