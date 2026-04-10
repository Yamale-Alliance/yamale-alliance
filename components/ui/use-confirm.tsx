"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useRef, useState } from "react";

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

/**
 * In-page confirmation (replaces window.confirm). Render `confirmDialog` in your tree.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const acceptedRef = useRef(false);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      acceptedRef.current = false;
      setOptions(opts);
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const finish = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        if (!acceptedRef.current) finish(false);
        acceptedRef.current = false;
      }
    },
    [finish]
  );

  const handleConfirm = useCallback(() => {
    acceptedRef.current = true;
    finish(true);
  }, [finish]);

  const confirmDialog =
    options != null ? (
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
              {options.title ?? "Confirm"}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {options.description}
            </Dialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {options.cancelLabel ?? "Cancel"}
                </button>
              </Dialog.Close>
                           <button
                type="button"
                onClick={handleConfirm}
                className={
                  options.variant === "destructive"
                    ? "inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90"
                    : "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                }
              >
                {options.confirmLabel ?? "Continue"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    ) : null;

  return { confirm, confirmDialog };
}

export type AlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
};

/**
 * In-page alert (replaces window.alert). Render `alertDialog` in your tree.
 */
export function useAlertDialog() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<AlertOptions | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);

  const alert = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setOpts({ message, title: title ?? "Notice" });
      resolverRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    resolverRef.current?.();
    resolverRef.current = null;
    setOpts(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) close();
    },
    [close]
  );

  const alertDialog =
    opts != null ? (
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">
              {opts.title ?? "Notice"}
            </Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {opts.message}
            </Dialog.Description>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={close}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {opts.okLabel ?? "OK"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    ) : null;

  return { alert, alertDialog };
}
