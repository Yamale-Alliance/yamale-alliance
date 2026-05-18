"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

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
}: LawContentsNavProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <Dialog.Title className="text-sm font-semibold text-foreground">Contents</Dialog.Title>
        <div className="flex items-center gap-2">
          {hasSubheadings ? (
            <button
              type="button"
              onClick={() => onShowSubheadingsChange(!showSubheadings)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {showSubheadings ? "Sections only" : "All headings"}
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close contents"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
      <ul
        className={`min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3 ${isRtl ? "text-right" : ""}`}
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
