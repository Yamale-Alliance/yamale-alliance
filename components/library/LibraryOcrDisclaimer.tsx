import { ScanText } from "lucide-react";

type Props = {
  className?: string;
  /** Shorter copy on individual law pages */
  compact?: boolean;
};

/**
 * Informs readers that library text is OCR-derived and may still be cleaned.
 */
export function LibraryOcrDisclaimer({ className = "", compact = false }: Props) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5 ${className}`}
      role="note"
      aria-label="OCR digitization notice"
    >
      <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-foreground dark:text-amber-50">
          {compact ? "Scanned text (OCR)" : "Library texts are being cleaned after OCR"}
        </p>
        {compact ? (
          <p className="mt-1 leading-relaxed text-muted-foreground dark:text-amber-100/90">
            This law was digitized from a scan. You may see stray characters, odd line breaks, or duplicate headings
            while we review it. Use <strong className="font-medium text-foreground dark:text-amber-50">Flag this law</strong>{" "}
            in the toolbar to report errors.
          </p>
        ) : (
          <p className="mt-1 leading-relaxed text-muted-foreground dark:text-amber-100/90">
            Many instruments were added from official gazettes and PDFs using optical character recognition (OCR). We
            are cleaning them over time. Until a document is fully reviewed, you may notice stray characters, broken
            formatting, duplicated headings, or gaps in the text. If something looks wrong, open the law and use{" "}
            <strong className="font-medium text-foreground dark:text-amber-50">Flag this law</strong> in the toolbar.
            Always verify important points against the official gazette or source named on the document.
          </p>
        )}
      </div>
    </div>
  );
}
