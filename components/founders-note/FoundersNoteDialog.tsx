"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FoundersNoteBody } from "@/components/founders-note/FoundersNoteBody";
import { usePlatformSettings } from "@/components/platform/PlatformSettingsContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
};

export function FoundersNoteDialog({ open, onOpenChange, onContinue }: Props) {
  const { founderPortraitUrl } = usePlatformSettings();
  const t = useTranslations("foundersNotePage.dialog");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] flex max-h-[min(90vh,calc(100%-2rem))] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="min-w-0 pe-2">
              <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                {t("title")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t("description")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("closeAria")}
                onClick={onContinue}
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
            <FoundersNoteBody portraitUrl={founderPortraitUrl} />
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link
              href="/founders-note"
              className="text-center text-sm font-medium text-[#8a6518] underline decoration-[#C8922A] underline-offset-2 hover:text-[#6e4f12] dark:text-[#e3ba65] sm:text-left"
              onClick={onContinue}
            >
              {t("readAgain")}
            </Link>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#0D1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162436] sm:w-auto dark:bg-primary dark:text-primary-foreground"
            >
              {t("continue")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
