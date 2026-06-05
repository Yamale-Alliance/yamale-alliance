"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Maximize2, X } from "lucide-react";
import type { RefObject } from "react";
import { EditableDocxPreview, type EditableDocxPreviewHandle } from "@/components/law-firm-development/EditableDocxPreview";
import { displayZipEntryName } from "@/lib/marketplace-zip-preview";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileLabel: string;
  blob: Blob;
  editorMountKey: string;
  initialHtml: string | null;
  editorRef: RefObject<EditableDocxPreviewHandle | null>;
  onHtmlChange: () => void;
  onReload: () => void;
};

export function AdvisoryDocumentExpandedPreview({
  open,
  onOpenChange,
  fileLabel,
  blob,
  editorMountKey,
  initialHtml,
  editorRef,
  onHtmlChange,
  onReload,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-2 z-[201] flex flex-col overflow-hidden rounded-xl border border-[rgba(193,140,67,0.25)] bg-[#1a120d] shadow-2xl focus:outline-none sm:inset-4 md:inset-8">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(193,140,67,0.15)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold text-white sm:text-lg">
                {displayZipEntryName(fileLabel)}
              </Dialog.Title>
              <Dialog.Description className="sr-only">Expanded editable document</Dialog.Description>
              <p className="mt-0.5 text-xs text-white/45">
                Edit in place · template text is protected from deletion
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onReload}
                className="rounded-[2px] border border-[rgba(193,140,67,0.35)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#C18C43] hover:bg-[rgba(193,140,67,0.08)]"
              >
                Reload template
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close expanded preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto max-w-5xl">
              {open && (
                <EditableDocxPreview
                  key={editorMountKey}
                  ref={editorRef}
                  blob={blob}
                  documentKey={editorMountKey}
                  initialHtml={initialHtml}
                  onHtmlChange={onHtmlChange}
                  expanded
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ExpandPreviewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-[2px] border border-[rgba(193,140,67,0.35)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#C18C43] transition hover:bg-[rgba(193,140,67,0.1)] hover:text-[#E3BA65]"
    >
      <Maximize2 className="h-3.5 w-3.5" aria-hidden />
      Larger preview
    </button>
  );
}
