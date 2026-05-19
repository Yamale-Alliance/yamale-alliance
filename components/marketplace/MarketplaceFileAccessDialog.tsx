"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, Eye, Loader2, X } from "lucide-react";

type MarketplaceFileAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName?: string | null;
  busy?: boolean;
  onPreview: () => void;
  onDownload: () => void;
};

export function MarketplaceFileAccessDialog({
  open,
  onOpenChange,
  fileName,
  busy = false,
  onPreview,
  onDownload,
}: MarketplaceFileAccessDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-semibold text-foreground">View or download</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {fileName ? (
                  <>
                    Choose how to open <span className="font-medium text-foreground">{fileName}</span>.
                  </>
                ) : (
                  "Choose how you would like to open this file."
                )}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onPreview();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Preview
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onDownload();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            In preview mode you can still download the file from the viewer toolbar.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
