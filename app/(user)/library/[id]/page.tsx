import { notFound, redirect } from "next/navigation";
import { isUuid } from "@/lib/content-slug";
import { lawPublicPath } from "@/lib/law-public-url";
import { resolveLawForPublicPage } from "@/lib/law-resolve-server";
import { createPageMetadata } from "@/lib/site-seo";
import LawDetailPageClient from "./LawDetailPageClient";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const meta = await resolveLawForPublicPage(id);
  if (!meta) {
    return createPageMetadata({
      title: "Law not found",
      description: "This law could not be found in the Yamalé Legal library.",
      path: "/library",
      noIndex: true,
    });
  }

  const path = lawPublicPath(meta.slug);
  const parts = [meta.country, meta.category, meta.year ? String(meta.year) : null].filter(Boolean);
  const description =
    parts.length > 0
      ? `${meta.title} — ${parts.join(" · ")}. Status: ${meta.status}. Read the full text in the Yamalé African law library.`
      : `${meta.title}. Status: ${meta.status}. Read the full text in the Yamalé African law library.`;

  return createPageMetadata({
    title: meta.title,
    description,
    path,
    keywords: [meta.country, meta.category, "African statute", "legal library"],
    ogType: "article",
  });
}

export default async function LawDetailPage({ params }: PageProps) {
  const { id: slugOrId } = await params;
  const meta = await resolveLawForPublicPage(slugOrId);
  if (!meta) notFound();

  if (isUuid(slugOrId) && meta.slug && slugOrId.toLowerCase() !== meta.slug.toLowerCase()) {
    redirect(lawPublicPath(meta.slug));
  }

  return <LawDetailPageClient slugOrId={meta.slug || meta.id} />;
}
