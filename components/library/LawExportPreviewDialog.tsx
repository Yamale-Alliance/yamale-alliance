"use client";

import * as Dialog from "@radix-ui/react-dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, FileDown, X } from "lucide-react";
import { PlatformLogo } from "@/components/platform/PlatformLogo";

export type LawExportPreviewLaw = {
  title: string;
  applies_to_all_countries?: boolean;
  countries: { name: string } | null;
  categories: { name: string } | null;
  year: number | null;
  status: string;
  language_code?: string | null;
  source_name: string | null;
  source_url: string | null;
};

export type LawExportPreviewSection = { id: string; title: string; body: string };

function stripInlineMarkdownBoldMarkers(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
}

function isLoneHeadingLabelLine(trimmed: string): boolean {
  const t = stripInlineMarkdownBoldMarkers(trimmed.trim());
  return (
    /^Article\s+\d+[.:]?\s*$/i.test(t) ||
    /^Chapter\s+\d+[.:]?\s*$/i.test(t) ||
    /^Chapitre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Section\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Art\.\s*\d+[.:]?\s*$/i.test(t) ||
    /^Ingingo\s+(ya\s+)?\d+[.:]?\s*$/i.test(t) ||
    /^Part\s+[A-Z][.:]?\s*$/i.test(t) ||
    /^Titre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^Title\s+[\dIVXLCDMivxlcdm]+[.:]?\s*$/i.test(t) ||
    /^TITLE\s+[\dIVXLCDM]+[.:]?\s*$/.test(t)
  );
}

function shouldMergeSubtitleLine(next: string): boolean {
  const t = stripInlineMarkdownBoldMarkers(next.trim());
  if (!t) return false;
  if (t.length > 180) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 16) return false;
  if (/^(This|These|Those|There|Here|It|They|If|When|Where|While|Unless|For|In\s+accordance|According|Upon|Notwithstanding|Subject\s+to|Each|Every|All|No\s+|Any\s+)\s+/i.test(t)) return false;
  if (/^(The|A|An)\s+/i.test(t)) {
    const looksLikeBodySentence =
      /\b(shall|must|may|should|will|are|is|was|were|have|has|having|been|undertake|undertakes|agree|agrees|determine|determines|provide|provides)\b/i.test(t) ||
      words.length > 14 ||
      /[.!?]\s*$/.test(t);
    if (looksLikeBodySentence) return false;
  }
  if (/^[a-z(—–-]/.test(t)) return false;
  return true;
}

/** Match law page: merge lone Article N + next subtitle for markdown bodies. */
function preprocessMarkdownBodyForHeadingMerge(body: string): string {
  if (!body.trim() || body.includes("```")) return body;
  const rawLines = body.replace(/\r\n/g, "\n").split("\n");
  const merged: string[] = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i]!;
    if (!line.trim()) {
      merged.push(line);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < rawLines.length && !rawLines[j]!.trim()) j++;
    const nextLine = j < rawLines.length ? rawLines[j] : undefined;
    const trimmed = stripInlineMarkdownBoldMarkers(line.trim());
    if (nextLine !== undefined && isLoneHeadingLabelLine(trimmed) && shouldMergeSubtitleLine(nextLine)) {
      merged.push(`${trimmed}: ${stripInlineMarkdownBoldMarkers(nextLine.trim())}`);
      i = j + 1;
      continue;
    }
    merged.push(line);
    i++;
  }
  return merged.join("\n");
}

function plainSectionTitle(title: string): string {
  const t = title.trim();
  const md = t.match(/^#{1,6}\s+(.+)$/);
  if (md) return md[1].trim().replace(/\*\*([^*]+)\*\*/g, "$1");
  const boldStar = t.match(/^\*\*(.+)\*\*\s*$/);
  if (boldStar) return boldStar[1].trim();
  const boldUnder = t.match(/^__(.+)__\s*$/);
  if (boldUnder) return boldUnder[1].trim();
  return t.replace(/^#{1,6}\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  law: LawExportPreviewLaw;
  sections: LawExportPreviewSection[];
  isRtl: boolean;
  logoUrl: string | null;
  onDownloadPdf: () => void | Promise<void>;
  pdfLoading: boolean;
};

export function LawExportPreviewDialog({
  open,
  onOpenChange,
  law,
  sections,
  isRtl,
  logoUrl,
  onDownloadPdf,
  pdfLoading,
}: Props) {
  const metaParts: string[] = [];
  if (law.applies_to_all_countries) metaParts.push("Scope: All countries");
  else if (law.countries?.name) metaParts.push(`Country: ${law.countries.name}`);
  if (law.categories?.name) metaParts.push(`Category: ${law.categories.name}`);
  if (law.language_code) metaParts.push(`Language: ${law.language_code.toUpperCase()}`);
  if (law.year != null) metaParts.push(`Year: ${law.year}`);
  if (law.status) metaParts.push(`Status: ${law.status}`);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm print:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] flex max-h-[min(92vh,calc(100%-1.5rem))] w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl print:fixed print:inset-0 print:max-h-none print:max-w-none print:h-auto print:w-full print:translate-x-0 print:translate-y-0 print:rounded-none print:border-0 print:shadow-none focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 print:hidden">
            <div className="min-w-0 flex-1 pe-2">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                Document preview
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Review the text below, then download the PDF.
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void onDownloadPdf()}
                disabled={pdfLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162436] disabled:opacity-50 dark:bg-primary dark:text-primary-foreground"
              >
                {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Download
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-100 p-3 print:overflow-visible print:bg-white print:p-0">
            <div
              id="law-export-preview-root"
              className="mx-auto max-w-none rounded-lg border border-neutral-200 bg-white px-5 py-6 text-neutral-900 shadow-sm print:mx-0 print:max-w-none print:rounded-none print:border-0 print:shadow-none sm:px-8 sm:py-8"
              dir={isRtl ? "rtl" : undefined}
            >
              <div className="mb-6 border-b border-neutral-200 pb-5 print:mb-4 print:pb-4">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic admin logo URL
                  <img src={logoUrl} alt="Yamalé" className="h-10 w-auto max-w-[200px] object-contain" />
                ) : (
                  <PlatformLogo height={40} width={200} className="h-10 w-auto max-w-[200px]" />
                )}
                <h1 className="heading mt-4 text-xl font-bold leading-snug text-[#0D1B2A] sm:text-2xl">{law.title}</h1>
                {metaParts.length > 0 && (
                  <p className="mt-2 text-xs text-neutral-600 sm:text-sm">{metaParts.join(" · ")}</p>
                )}
                {(law.source_name || law.source_url) && (
                  <p className="mt-1 break-all text-[11px] text-neutral-500">
                    {[law.source_name, law.source_url].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-3 text-[10px] leading-relaxed text-neutral-500">
                  Yamalé Legal Platform — reference copy. Not legal advice; verify with official sources.
                </p>
              </div>

              <div className="law-export-preview-prose prose prose-sm max-w-none text-neutral-900 prose-headings:text-[#0D1B2A] prose-p:text-justify prose-p:leading-[1.7] prose-th:border prose-th:border-neutral-300 prose-th:bg-neutral-100 prose-th:px-2 prose-th:py-1.5 prose-td:border prose-td:border-neutral-200 prose-td:px-2 prose-td:py-1.5 prose-table:text-sm print:prose-sm">
                {sections.map((sec) => (
                  <section key={sec.id} className="mb-10 print:mb-7">
                    <h2 className="heading mb-4 border-s-4 border-[#C8922A] ps-3 text-lg font-extrabold uppercase tracking-[0.03em] text-[#0D1B2A] sm:text-xl">
                      {plainSectionTitle(sec.title)}
                    </h2>
                    {sec.body?.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {preprocessMarkdownBodyForHeadingMerge(sec.body)}
                      </ReactMarkdown>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
