export type PolicyInlineSegment =
  | { kind: "text"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "link"; href: string; label: string }
  | { kind: "email"; address: string };

export type PolicyBlock =
  | { type: "p"; segments: PolicyInlineSegment[] }
  | { type: "bullets"; items: Array<string | { label: string; text: string }> }
  | { type: "callout"; label: string; segments: PolicyInlineSegment[] }
  | { type: "label"; label: string; blocks: PolicyBlock[] };

export type PolicySection = {
  id?: string;
  number: string;
  title: string;
  blocks: PolicyBlock[];
};

export type PolicySubSection = {
  number: string;
  title: string;
  blocks: PolicyBlock[];
};

export type PolicyDocumentSection = PolicySection | PolicySubSection;

export function isPolicySection(section: PolicyDocumentSection): section is PolicySection {
  return "blocks" in section && !("number" in section && section.title.includes(".") === false);
}

export type PolicyDocument = {
  meta: {
    title: string;
    description: string;
    heroTitle: string;
    heroSubtitle: string;
    dateLine: string;
  };
  sections: Array<
    | { kind: "section"; id?: string; number: string; title: string; blocks: PolicyBlock[] }
    | { kind: "subsection"; number: string; title: string; blocks: PolicyBlock[] }
  >;
  updatedBanner: PolicyInlineSegment[];
  footerLinks: Array<{ href: string; label: string }>;
};

export type LegalDocumentId = "terms" | "privacy" | "paymentRefund";
