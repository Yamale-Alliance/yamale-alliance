"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, X } from "lucide-react";
import { useTranslations } from "next-intl";

type LibrarySignInDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to return after sign-in (path + query, no origin). */
  returnPath: string;
};

export function LibrarySignInDialog({ open, onOpenChange, returnPath }: LibrarySignInDialogProps) {
  const t = useTranslations("library.signInPrompt");
  const tCommon = useTranslations("common");
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnPath)}`;
  const signUpHref = `/signup?redirect_url=${encodeURIComponent(returnPath)}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" aria-hidden />
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={tCommon("close")}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="mt-4 text-xl font-semibold tracking-tight text-foreground">
            {t("dialogTitle")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("dialogBody")}
          </Dialog.Description>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href={signInHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              onClick={() => onOpenChange(false)}
            >
              {t("signIn")}
            </Link>
            <Link
              href={signUpHref}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              {t("createAccount")}
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
