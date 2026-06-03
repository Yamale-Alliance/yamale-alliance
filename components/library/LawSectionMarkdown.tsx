"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function headingAnchorId(raw: ReactNode): string {
  if (typeof raw === "string") {
    return raw
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }
  return "";
}

function preprocessMarkdownBodyForHeadingMerge(body: string): string {
  return body.replace(/\n(#{1,3})\s+/g, "\n\n$1 ");
}

type Props = {
  body: string;
};

/** Markdown body for law sections — loaded on demand to shrink the law detail bundle. */
export function LawSectionMarkdown({ body }: Props) {
  return (
    <div className="prose prose-base max-w-none break-words text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-headings:break-words prose-p:text-left prose-p:leading-[1.85] prose-p:text-foreground/90 prose-li:leading-[1.8] prose-li:text-foreground/90 prose-pre:overflow-x-auto dark:prose-invert print:max-w-none print:prose-neutral">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-blue-600 font-bold underline decoration-blue-600 break-words hover:decoration-blue-600"
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ children, ...props }) => (
            <div className="-mx-1 my-6 overflow-x-auto sm:mx-0">
              <table className="min-w-full" {...props}>
                {children}
              </table>
            </div>
          ),
          h1: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h1 id={id} className="scroll-mt-24 break-words" {...props}>
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h2 id={id} className="scroll-mt-24 break-words" {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h3 id={id} className="scroll-mt-24 break-words" {...props}>
                {children}
              </h3>
            );
          },
        }}
      >
        {preprocessMarkdownBodyForHeadingMerge(body)}
      </ReactMarkdown>
    </div>
  );
}
