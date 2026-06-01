import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FoundersNoteBody } from "@/components/founders-note/FoundersNoteBody";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Founder's Note",
  description:
    "Why we built Yamalé — a message from Meghan Waters, CEO, on the gap in African legal infrastructure and building the platform together.",
  path: "/founders-note",
  ogType: "article",
});

export const revalidate = 60;

export default async function FoundersNotePage() {
  const { founderPortraitUrl } = await getPlatformBranding();

  return (
    <div className="bg-background">
      <div className="border-b border-border bg-[#0D1B2A] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <FoundersNoteBody portraitUrl={founderPortraitUrl} />
        <p className="mt-10 text-sm text-muted-foreground">
          You can return to this page anytime from the footer under{" "}
          <span className="font-medium text-foreground">Company → Founder&apos;s note</span>.
        </p>
      </div>
    </div>
  );
}
