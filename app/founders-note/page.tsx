import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { FoundersNoteBody } from "@/components/founders-note/FoundersNoteBody";
import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createPageMetadata } from "@/lib/site-seo";

export async function generateMetadata() {
  const t = await getTranslations("foundersNotePage");
  return createPageMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    path: "/founders-note",
    ogType: "article",
  });
}

export const revalidate = 60;

export default async function FoundersNotePage() {
  const { founderPortraitUrl } = await getPlatformBranding();
  const t = await getTranslations("foundersNotePage");
  const localeRaw = await getLocale();
  const locale: Locale = isLocale(localeRaw) ? localeRaw : "en";

  return (
    <div className="bg-background" lang={locale}>
      <div className="border-b border-border bg-[#0D1B2A] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("backToHome")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <FoundersNoteBody portraitUrl={founderPortraitUrl} />
        <p className="mt-10 text-sm text-muted-foreground">
          {t("footerHint")}{" "}
          <span className="font-medium text-foreground">{t("footerHintPath")}</span>.
        </p>
      </div>
    </div>
  );
}
