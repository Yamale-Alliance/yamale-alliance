"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  applyTemplateBaselinesToDraft,
  attachTemplateEditGuards,
  collectTemplateBaselines,
  markTemplateBaseline,
} from "@/lib/advisory-docx-editor";

export type EditableDocxPreviewHandle = {
  getHtml: () => string;
};

type Props = {
  blob: Blob;
  /** Changes only when switching inline/expanded or reloading — not on each keystroke. */
  documentKey: string;
  /** HTML applied once when documentKey changes (saved draft or transfer between views). */
  initialHtml?: string | null;
  onHtmlChange?: () => void;
  expanded?: boolean;
  className?: string;
};

function enableEditing(root: HTMLElement) {
  root.setAttribute("contenteditable", "true");
  root.setAttribute("spellcheck", "true");
  root.setAttribute("aria-label", "Editable document");
  root.querySelectorAll<HTMLElement>(".docx-wrapper, section.docx, article").forEach((el) => {
    el.setAttribute("contenteditable", "true");
  });
}

export const EditableDocxPreview = forwardRef<EditableDocxPreviewHandle, Props>(
  function EditableDocxPreview(
    { blob, documentKey, initialHtml, onHtmlChange, expanded = false, className = "" },
    ref
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const mountedKeyRef = useRef<string | null>(null);
    const onHtmlChangeRef = useRef(onHtmlChange);
    onHtmlChangeRef.current = onHtmlChange;

    const getHtml = useCallback(() => hostRef.current?.innerHTML.trim() ?? "", []);

    useImperativeHandle(ref, () => ({ getHtml }), [getHtml]);

    useEffect(() => {
      const el = hostRef.current;
      if (!el || mountedKeyRef.current === documentKey) return;

      let cancelled = false;
      let detachGuards: (() => void) | undefined;
      mountedKeyRef.current = documentKey;
      el.innerHTML = "";

      const finishSetup = (root: HTMLElement) => {
        if (cancelled) return;
        enableEditing(root);
        detachGuards = attachTemplateEditGuards(root);
      };

      const htmlToApply = initialHtml?.trim();

      void (async () => {
        try {
          const { renderAsync } = await import("docx-preview");
          if (cancelled || !hostRef.current) return;

          let baselines: string[] | null = null;
          if (htmlToApply) {
            const scratch = document.createElement("div");
            await renderAsync(blob, scratch, undefined, {
              inWrapper: true,
              breakPages: true,
              ignoreWidth: true,
              ignoreHeight: true,
              ignoreFonts: false,
              renderEndnotes: true,
              renderFootnotes: true,
            });
            baselines = collectTemplateBaselines(scratch);
            if (cancelled || !hostRef.current) return;
            hostRef.current.innerHTML = htmlToApply;
            applyTemplateBaselinesToDraft(hostRef.current, baselines);
            finishSetup(hostRef.current);
            return;
          }

          await renderAsync(blob, hostRef.current, undefined, {
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: true,
            ignoreFonts: false,
            renderEndnotes: true,
            renderFootnotes: true,
          });
          if (!cancelled && hostRef.current) {
            finishSetup(hostRef.current);
          }
        } catch {
          if (!cancelled && hostRef.current) {
            hostRef.current.innerHTML = "";
            const p = document.createElement("p");
            p.className = "px-4 text-center text-sm text-red-400";
            p.textContent = "Could not render this Word document.";
            hostRef.current.appendChild(p);
          }
        }
      })();

      return () => {
        cancelled = true;
        detachGuards?.();
        el.innerHTML = "";
        if (mountedKeyRef.current === documentKey) mountedKeyRef.current = null;
      };
      // initialHtml intentionally omitted — only applied when documentKey changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blob, documentKey]);

    const frameClass = expanded
      ? "h-[min(88vh,960px)]"
      : "h-[min(75vh,820px)] min-h-[28rem]";

    return (
      <div
        className={`w-full overflow-auto rounded-md border border-[rgba(193,140,67,0.2)] bg-[#2a2118] p-3 sm:p-5 ${frameClass} ${className}`}
      >
        <div
          ref={hostRef}
          onInput={() => onHtmlChangeRef.current?.()}
          className={
            "docx-preview-host docx-preview-editable mx-auto w-full max-w-5xl rounded-sm bg-[#f8f6f2] px-4 py-6 text-[13px] leading-relaxed text-[#1a120d] shadow-md outline-none focus-within:ring-1 focus-within:ring-[rgba(193,140,67,0.35)] " +
            "[&_.docx-wrapper]:mx-auto [&_.docx-wrapper]:w-full [&_.docx-wrapper]:max-w-full " +
            "[&_section.docx]:mx-auto [&_section.docx]:w-full [&_section.docx]:max-w-full"
          }
        />
      </div>
    );
  }
);
