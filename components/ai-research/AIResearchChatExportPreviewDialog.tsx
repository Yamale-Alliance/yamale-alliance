"use client";

import * as Dialog from "@radix-ui/react-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, FileDown, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PlatformLogo } from "@/components/platform/PlatformLogo";
import {
  filterAiResearchSourceCardsForDisplay,
  filterAiResearchSourcesForDisplay,
} from "@/lib/ai-research-source-cards";
import { containsArabicScript } from "@/lib/pdf-latin-sanitize";
import { translateLawCategoryLabel } from "@/lib/i18n/catalog-labels";
import {
  dialogPanelBaseClass,
  dialogScrollViewportClass,
  dialogScrollViewportInnerClass,
} from "@/components/ui/dialog-shell-classes";

export type AIResearchExportPreviewMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  sourceCards?: Array<{
    lawId: string;
    title: string;
    country: string;
    category: string;
    status: string;
    snippet: string;
    docSlot?: number;
    usedInAnswer?: boolean;
    sourceKind?: "law" | "methodology";
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  messages: AIResearchExportPreviewMessage[];
  exportedAt: Date;
  logoUrl: string | null;
  onDownloadPdf: () => void | Promise<void>;
  pdfLoading: boolean;
};

function isConversationPrimarilyArabic(messages: AIResearchExportPreviewMessage[]): boolean {
  const blob = messages.map((m) => m.content).join("\n");
  if (!blob.trim()) return false;
  const ar = (blob.match(/[\u0600-\u06FF]/g) ?? []).length;
  const lat = (blob.match(/[A-Za-z]/g) ?? []).length;
  return ar > 0 && ar >= lat * 0.25;
}

const markdownLink = {
  a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  ),
};

export function AIResearchChatExportPreviewDialog({
  open,
  onOpenChange,
  title,
  messages,
  exportedAt,
  logoUrl,
  onDownloadPdf,
  pdfLoading,
}: Props) {
  const locale = useLocale();
  const isRtl = isConversationPrimarilyArabic(messages);
  const dateLabel = exportedAt.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm print:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className={`${dialogScrollViewportClass} z-[101] print:contents`}>
          <div className={`${dialogScrollViewportInnerClass} print:min-h-0 print:p-0`}>
            <Dialog.Content
              className={`${dialogPanelBaseClass} max-w-3xl overflow-hidden print:fixed print:inset-0 print:max-h-none print:max-w-none print:h-auto print:w-full print:rounded-none print:border-0 print:shadow-none`}
            >
              <PreviewHeader onDownload={() => void onDownloadPdf()} pdfLoading={pdfLoading} />

              <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-100 p-3 print:overflow-visible print:bg-white print:p-0">
                <div
                  id="ai-research-export-preview-root"
                  className="mx-auto max-w-none rounded-lg border border-neutral-200 bg-white px-5 py-6 text-neutral-900 shadow-sm print:mx-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none sm:px-8 sm:py-8"
                  dir={isRtl ? "rtl" : undefined}
                >
                  <PreviewPaperHeader logoUrl={logoUrl} title={title} dateLabel={dateLabel} />
                  <PreviewMessages messages={messages} isRtl={isRtl} />
                </div>
              </div>
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewHeader({
  onDownload,
  pdfLoading,
}: {
  onDownload: () => void;
  pdfLoading: boolean;
}) {
  const t = useTranslations("aiResearch.export");

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 print:hidden">
      <div className="min-w-0 flex-1 pe-2">
        <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
          {t("previewTitle")}
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-xs text-muted-foreground">
          {t("previewDescription")}
        </Dialog.Description>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={pdfLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162436] disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
        >
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {t("downloadPdf")}
        </button>
        <Dialog.Close asChild>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </Dialog.Close>
      </div>
    </div>
  );
}

function PreviewPaperHeader({
  logoUrl,
  title,
  dateLabel,
}: {
  logoUrl: string | null;
  title: string;
  dateLabel: string;
}) {
  const t = useTranslations("aiResearch.export");

  return (
    <div className="mb-6 border-b border-neutral-200 pb-5 print:mb-4 print:pb-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic admin logo URL
        <img src={logoUrl} alt="Yamalé" className="h-10 w-auto max-w-[200px] object-contain" />
      ) : (
        <PlatformLogo height={40} width={200} className="h-10 w-auto max-w-[200px]" />
      )}
      <h1 className="heading mt-4 text-xl font-bold leading-snug text-[#0D1B2A] sm:text-2xl">{title}</h1>
      <p className="mt-2 text-xs text-neutral-600 sm:text-sm">{t("exportedOn", { date: dateLabel })}</p>
      <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">{t("disclaimer")}</p>
    </div>
  );
}

function PreviewMessages({
  messages,
  isRtl,
}: {
  messages: AIResearchExportPreviewMessage[];
  isRtl: boolean;
}) {
  const t = useTranslations("aiResearch.export");
  const tLibrary = useTranslations("library");

  return (
    <div className="space-y-5">
      {messages.map((msg) => (
        <section
          key={msg.id}
          className={`rounded-lg border px-4 py-3 print:break-inside-avoid ${
            msg.role === "user"
              ? "border-[#C8922A]/30 bg-[#FFFDF8]"
              : "border-neutral-200 bg-neutral-50/80"
          }`}
          dir={containsArabicScript(msg.content) ? "rtl" : isRtl ? "rtl" : undefined}
        >
          <p
            className={`mb-2 text-[10px] font-bold uppercase tracking-[0.1em] ${
              msg.role === "user" ? "text-[#C8922A]" : "text-[#0D1B2A]"
            }`}
          >
            {msg.role === "user" ? t("yourQuestion") : t("assistantLabel")}
          </p>
          {msg.role === "assistant" ? (
            <div className="prose prose-sm max-w-none text-neutral-900 prose-headings:text-[#0D1B2A] prose-p:text-justify prose-p:leading-[1.65] prose-a:text-[#C8922A]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLink}>
                {msg.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-neutral-800">{msg.content}</p>
          )}
          {(() => {
            const displaySources = filterAiResearchSourcesForDisplay(msg.sources);
            return displaySources.length > 0 ? (
              <div className="mt-3 border-t border-neutral-200 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {t("sourcesConsulted")}
                </p>
                <ol className="mt-1 list-decimal space-y-0.5 ps-4 text-[11px] text-neutral-600">
                  {displaySources.slice(0, 12).map((src, i) => (
                    <li key={`${msg.id}-src-${i}`}>{src}</li>
                  ))}
                </ol>
                {displaySources.length > 12 ? (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {t("andMore", { count: displaySources.length - 12 })}
                  </p>
                ) : null}
              </div>
            ) : null;
          })()}
          {(() => {
            const displayCards = filterAiResearchSourceCardsForDisplay(msg.sourceCards);
            return displayCards.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-neutral-200 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  {t("libraryExcerpts", { count: displayCards.length })}
                </p>
                {displayCards.map((card, idx) => (
                  <div
                    key={`${msg.id}-card-${card.lawId}-${idx}`}
                    className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px]"
                  >
                    <p className="font-semibold text-[#0D1B2A]">
                      {card.docSlot ?? idx + 1}. {card.title}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {card.country} · {translateLawCategoryLabel(card.category, tLibrary)} · {card.status}
                    </p>
                    {card.snippet ? (
                      <p className="mt-1 text-[11px] leading-snug text-neutral-600">&ldquo;{card.snippet}&rdquo;</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </section>
      ))}
    </div>
  );
}
