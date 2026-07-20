"use client";

import type { ReactNode } from "react";
import { linkifyLawRichText } from "@/lib/library/law-reader-linkify";
import {
  LAW_HEADING_LABEL_ONLY,
  LAW_HEADING_LABEL_SPLIT,
  stripInlineMarkdownBoldMarkers,
  stripLeadingMarkdownHeadingMarkers,
  toTitleCaseHeading,
} from "@/lib/library/law-structure";

type LawSubheadingProps = {
  text: string;
  variant: "h2" | "h3";
  anchorIndex: Map<string, string>;
};

/** Styled chapter / article heading with label + subtitle split when present. */
export function LawSubheading({ text, variant, anchorIndex }: LawSubheadingProps): ReactNode {
  const plain = stripLeadingMarkdownHeadingMarkers(stripInlineMarkdownBoldMarkers(text).trim());
  const m = plain.match(LAW_HEADING_LABEL_SPLIT);

  if (m) {
    const label = m[1];
    const subtitle = m[2].trim();
    const subtitleDisplay = subtitle === subtitle.toUpperCase() ? toTitleCaseHeading(subtitle) : subtitle;
    if (variant === "h2") {
      return (
        <>
          <span className="law-chapter-heading__label">{linkifyLawRichText(label, anchorIndex)}</span>
          <span className="law-chapter-heading__subtitle">{linkifyLawRichText(subtitleDisplay, anchorIndex)}</span>
        </>
      );
    }
    return (
      <>
        <span className="law-article-heading__label">{linkifyLawRichText(label, anchorIndex)}</span>
        <span className="law-article-heading__title">{linkifyLawRichText(subtitleDisplay, anchorIndex)}</span>
      </>
    );
  }

  if (variant === "h2") {
    return <span className="law-chapter-heading__label">{linkifyLawRichText(plain, anchorIndex)}</span>;
  }

  const articleMatch = plain.match(LAW_HEADING_LABEL_ONLY);
  if (articleMatch) {
    const labelText = toTitleCaseHeading(articleMatch[1]);
    return <span className="law-article-heading__title law-article-heading__title--solo">{linkifyLawRichText(labelText, anchorIndex)}</span>;
  }

  return <span className="law-article-heading__title">{linkifyLawRichText(plain, anchorIndex)}</span>;
}
