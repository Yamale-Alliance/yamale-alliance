"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export type LawOutlineItem = {
  id: string;
  title: string;
  level: "section" | "sub";
};

type LawContentsNavProps = {
  items: LawOutlineItem[];
  activeSectionId: string;
  onSelect: (id: string) => void;
  isRtl?: boolean;
  hasSubheadings: boolean;
  showSubheadings: boolean;
  onShowSubheadingsChange: (show: boolean) => void;
  onClose?: () => void;
  /** Sticky column beside the document (not a modal). */
  embedded?: boolean;
};

export function LawContentsNav({
  items,
  activeSectionId,
  onSelect,
  isRtl = false,
  hasSubheadings,
  showSubheadings,
  onShowSubheadingsChange,
  onClose,
  embedded = false,
}: LawContentsNavProps) {
  const t = useTranslations("library.detail");

  const title = <span className="text-sm font-semibold text-foreground">{t("contents")}</span>;

  return (
    <div className="law-contents-nav flex min-h-0 max-h-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        {embedded ? title : <Dialog.Title asChild>{title}</Dialog.Title>}
        <div className="flex items-center gap-2">
          {hasSubheadings ? (
            <button
              type="button"
              onClick={() => onShowSubheadingsChange(!showSubheadings)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showSubheadings ? t("tocSectionsOnly") : t("tocAllHeadings")}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t("closeContents")}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
      <ul
        className={`law-contents-nav-list min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain px-3 py-3 ${isRtl ? "text-right" : ""}`}
        dir={isRtl ? "rtl" : undefined}
      >
        {items.map((item) => (
          <li key={item.id} className={item.level === "sub" ? (isRtl ? "pr-3" : "pl-3") : undefined}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`block w-full rounded-md py-2 text-left transition ${
                item.level === "section" ? "px-2 text-sm font-semibold" : "px-2 text-xs"
              } ${isRtl ? "text-right" : ""} ${
                activeSectionId === item.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
              title={item.title.length > 56 ? item.title : undefined}
            >
              <span className="line-clamp-2">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
