import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FoundersNoteBody } from "@/components/founders-note/FoundersNoteBody";
import { getPlatformSettings } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Founder's Note — Yamalé",
  description:
    "Why we built Yamalé — a message from Meghan Waters, Chief Executive Officer, on African legal infrastructure and launching together.",
};

export default async function FoundersNotePage() {
  const { founderPortraitUrl } = await getPlatformSettings();

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
