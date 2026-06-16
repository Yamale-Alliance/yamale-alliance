import type { ReactNode } from "react";
import { LawReaderLink } from "@/components/library/LawReaderLink";
import { buildLawAnchorIndex, lawAnchorKey, splitTextWithLawCitations } from "@/lib/library/law-internal-refs";

export { buildLawAnchorIndex };

function linkifyUrls(text: string): ReactNode {
  if (!text?.trim()) return text;
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,;:?!)\]]+$/, "");
      return (
        <LawReaderLink key={i} href={href}>
          {part}
        </LawReaderLink>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function linkifyCitations(text: string, anchorIndex: Map<string, string>): ReactNode {
  if (!anchorIndex.size) return linkifyUrls(text);
  const segments = splitTextWithLawCitations(text);
  if (segments.length === 1 && segments[0]?.kind === "text") {
    return linkifyUrls(text);
  }
  return segments.map((segment, i) => {
    if (segment.kind === "cite") {
      const targetId = anchorIndex.get(lawAnchorKey(segment.value));
      if (targetId) {
        return (
          <LawReaderLink key={i} href={`#${targetId}`}>
            {segment.value}
          </LawReaderLink>
        );
      }
      return <span key={i}>{segment.value}</span>;
    }
    return <span key={i}>{linkifyUrls(segment.value)}</span>;
  });
}

/** URLs and in-document citations (Section N, Article N, …). */
export function linkifyLawText(text: string, anchorIndex: Map<string, string> = new Map()): ReactNode {
  if (!text?.trim()) return text;
  return linkifyCitations(text, anchorIndex);
}

/** Inline `**bold**` plus URLs and citations. */
export function linkifyLawRichText(text: string, anchorIndex: Map<string, string> = new Map()): ReactNode {
  if (text == null || text === "") return text;
  const segments: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push(
        <span key={`t-${k++}`}>{linkifyLawText(text.slice(last, m.index), anchorIndex)}</span>
      );
    }
    const raw = m[1];
    const inner =
      raw.startsWith("**") && raw.endsWith("**")
        ? raw.slice(2, -2)
        : raw.startsWith("__") && raw.endsWith("__")
          ? raw.slice(2, -2)
          : raw;
    segments.push(
      <strong key={`b-${k++}`} className="font-semibold text-foreground">
        {linkifyLawText(inner, anchorIndex)}
      </strong>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push(<span key={`t-${k++}`}>{linkifyLawText(text.slice(last), anchorIndex)}</span>);
  }
  return segments.length > 0 ? <>{segments}</> : linkifyLawText(text, anchorIndex);
}
