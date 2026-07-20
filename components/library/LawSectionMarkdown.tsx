"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LawReaderLink } from "@/components/library/LawReaderLink";
import { LawSubheading } from "@/components/library/LawSubheading";
import {
  listMarkdownBodyHeadings,
  preprocessMarkdownBodyForHeadingMerge,
} from "@/lib/library/law-structure";

type Props = {
  body: string;
  sectionId: string;
  anchorIndex: Map<string, string>;
};

/** Markdown body for law sections — typography matches plain-text article headings. */
export function LawSectionMarkdown({ body, sectionId, anchorIndex }: Props) {
  const preparedBody = useMemo(() => preprocessMarkdownBodyForHeadingMerge(body), [body]);
  const headingSlots = useMemo(
    () => listMarkdownBodyHeadings(body, sectionId),
    [body, sectionId]
  );
  let headingRenderIndex = 0;

  const nextHeadingId = () => headingSlots[headingRenderIndex]?.id;

  const renderHeading = (Tag: "h1" | "h2" | "h3" | "h4", children: React.ReactNode, props: object) => {
    const id = nextHeadingId();
    if (id) headingRenderIndex += 1;
    const text =
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? children.map((c) => (typeof c === "string" ? c : "")).join("")
          : String(children ?? "");
    return (
      <Tag id={id} className="law-article-block scroll-mt-24" {...props}>
        <LawSubheading text={text} variant="h3" anchorIndex={anchorIndex} />
      </Tag>
    );
  };

  return (
    <div className="law-markdown-body break-words print:max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <LawReaderLink href={href} {...props}>
              {children}
            </LawReaderLink>
          ),
          img: ({ alt, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} alt={alt ?? ""} className="my-6 h-auto max-w-full rounded-lg" loading="lazy" />
          ),
          table: ({ children, ...props }) => (
            <div className="-mx-1 my-6 overflow-x-auto sm:mx-0">
              <table className="min-w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          h1: ({ children, ...props }) => renderHeading("h1", children, props),
          h2: ({ children, ...props }) => renderHeading("h2", children, props),
          h3: ({ children, ...props }) => renderHeading("h3", children, props),
          h4: ({ children, ...props }) => renderHeading("h4", children, props),
        }}
      >
        {preparedBody}
      </ReactMarkdown>
    </div>
  );
}
