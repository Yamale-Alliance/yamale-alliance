"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bug, BookMarked, MessageSquareWarning, Scale, SearchX } from "lucide-react";
import { AiBugsPanel } from "@/components/admin/ai-moderation/AiBugsPanel";
import { AiCorpusGapsPanel } from "@/components/admin/ai-moderation/AiCorpusGapsPanel";
import { AiFlaggedFeedbackPanel } from "@/components/admin/ai-moderation/AiFlaggedFeedbackPanel";
import { LegalSynonymsPanel } from "@/components/admin/ai-moderation/LegalSynonymsPanel";
import { RetrievalNotFoundPanel } from "@/components/admin/ai-moderation/RetrievalNotFoundPanel";

const TAB_VALUES = ["bugs", "corpus-gaps", "feedback", "synonyms", "not-found"] as const;
export type AiQualityTab = (typeof TAB_VALUES)[number];

function normalizeTab(raw: string | null): AiQualityTab {
  if (
    raw === "feedback" ||
    raw === "bugs" ||
    raw === "corpus-gaps" ||
    raw === "synonyms" ||
    raw === "not-found"
  ) {
    return raw;
  }
  return "bugs";
}

export function AdminAiModerationHub() {
  const t = useTranslations("admin.aiModeration");
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = normalizeTab(searchParams.get("tab"));

  const setTab = (value: string) => {
    const v = normalizeTab(value);
    router.replace(`/admin-panel/ai-quality?tab=${encodeURIComponent(v)}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
      <div className="border-b border-border/60 pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/90">{t("eyebrow")}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {t("subtitle")}
        </p>
      </div>

      <Tabs.Root value={tab} onValueChange={setTab} className="mt-8">
        <Tabs.List className="flex flex-wrap gap-1.5 rounded-2xl border border-border/70 bg-muted/30 p-1.5 shadow-inner">
          <Tabs.Trigger
            value="bugs"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none"
          >
            <Bug className="h-4 w-4" />
            {t("tabs.bugs")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="corpus-gaps"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none"
          >
            <Scale className="h-4 w-4" />
            {t("tabs.corpusGaps")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="feedback"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none"
          >
            <MessageSquareWarning className="h-4 w-4" />
            {t("tabs.feedback")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="synonyms"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none"
          >
            <BookMarked className="h-4 w-4" />
            {t("tabs.synonyms")}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="not-found"
            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=inactive]:hover:text-foreground sm:flex-none"
          >
            <SearchX className="h-4 w-4" />
            {t("tabs.notFound")}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="bugs" className="mt-8 outline-none">
          <AiBugsPanel />
        </Tabs.Content>
        <Tabs.Content value="corpus-gaps" className="mt-8 outline-none">
          <AiCorpusGapsPanel />
        </Tabs.Content>
        <Tabs.Content value="feedback" className="mt-8 outline-none">
          <AiFlaggedFeedbackPanel />
        </Tabs.Content>
        <Tabs.Content value="synonyms" className="mt-8 outline-none">
          <LegalSynonymsPanel />
        </Tabs.Content>
        <Tabs.Content value="not-found" className="mt-8 outline-none">
          <RetrievalNotFoundPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
