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
    <div className="prose prose-lg max-w-none leading-relaxed text-foreground prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-p:leading-[1.75] prose-p:text-justify prose-p:text-foreground/90 prose-li:text-foreground dark:prose-invert print:max-w-none print:prose-neutral">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="!text-blue-600 font-bold underline decoration-blue-600 hover:decoration-blue-600"
              {...props}
            >
              {children}
            </a>
          ),
          h1: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h1 id={id} className="scroll-mt-24" {...props}>
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h2 id={id} className="scroll-mt-24" {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = headingAnchorId(children) || undefined;
            return (
              <h3 id={id} className="scroll-mt-24" {...props}>
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
