"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, FileText, Loader2, GripVertical, ArrowUp, ArrowDown, Menu, X, Bookmark, BookmarkCheck, FileEdit } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type LawStatus = "In force" | "Amended" | "Repealed";

type LawDetail = {
  id: string;
  title: string;
  source_url: string | null;
  source_name: string | null;
  year: number | null;
  status: string;
  content: string | null;
  content_plain: string | null;
  country_id: string;
  category_id: string;
  countries: { name: string } | null;
  categories: { name: string } | null;
};

type Section = { id: string; title: string; body: string };

// Check if a line looks like a table row (numbers and hyphens, space-separated)
function isTableRow(line: string): { cells: string[] } | null {
  const t = line.trim();
  if (!t) return null;
  const cells = t.split(/\s+/).filter(Boolean);
  if (cells.length < 2) return null;
  const allCellLike = cells.every((c) => /^\d+$/.test(c) || c === "-");
  return allCellLike ? { cells } : null;
}

// Markdown pipe table: | Col1 | Col2 | or |---|---|
function isMarkdownTableLine(line: string): boolean {
  const t = line.trim();
  if (!t || !t.includes("|")) return false;
  const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
  return cells.length >= 2;
}

function parseMarkdownTableLine(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== ""); // keep all cells; for "| A | B |" we get [A, B]
}

function isMarkdownTableSeparatorRow(cells: string[]): boolean {
  return cells.length >= 1 && cells.every((c) => /^-+$/.test(c.trim()));
}

// Parse body into blocks: table (numeric/space-separated or Markdown pipe), or paragraph
type BodyBlock = { type: "table"; rows: string[][] } | { type: "paragraph"; text: string };
function parseBodyBlocks(body: string): BodyBlock[] {
  const lines = body.split(/\n/);
  const blocks: BodyBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 1) Existing numeric/space-separated table
    const rowResult = isTableRow(line);
    if (rowResult) {
      const rows: string[][] = [rowResult.cells];
      const colCount = rowResult.cells.length;
      i++;
      while (i < lines.length) {
        const next = isTableRow(lines[i]);
        if (!next || next.cells.length !== colCount) break;
        rows.push(next.cells);
        i++;
      }
      if (rows.length >= 1) blocks.push({ type: "table", rows });
      continue;
    }
    // 2) Markdown pipe table (e.g. | Classes | Commune de Dakar | ...)
    if (isMarkdownTableLine(line)) {
      const rows: string[][] = [];
      let colCount = 0;
      while (i < lines.length && isMarkdownTableLine(lines[i])) {
        const cells = parseMarkdownTableLine(lines[i]);
        if (cells.length >= 2) {
          if (isMarkdownTableSeparatorRow(cells)) {
            i++;
            continue;
          }
          if (colCount === 0) colCount = cells.length;
          if (cells.length === colCount) rows.push(cells);
        }
        i++;
      }
      if (rows.length >= 1) blocks.push({ type: "table", rows });
      continue;
    }
    // 3) Paragraph
    const paraLines: string[] = [];
    while (i < lines.length && !isTableRow(lines[i]) && !isMarkdownTableLine(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    const text = paraLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}

// Body items for a section: table, paragraph, or sub-heading (with id for sidebar/scroll)
type BodyItem =
  | { type: "table"; rows: string[][] }
  | { type: "p"; text: string }
  | { type: "h3"; text: string; id: string };
function getBodyItems(sec: Section): BodyItem[] {
  const items: BodyItem[] = [];
  let subIdx = 0;
  for (const block of parseBodyBlocks(sec.body)) {
    if (block.type === "table") {
      items.push({ type: "table", rows: block.rows });
      continue;
    }
    const lines = block.text
      .split(/\n/)
      .filter((l) => !isPageMarker(l) && !isJunkLine(l))
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines) {
      if (isSubHeadingLine(line)) {
        items.push({ type: "h3", text: line, id: `${sec.id}-h-${subIdx++}` });
      } else {
        items.push({ type: "p", text: line });
      }
    }
  }
  return items;
}

// Full outline for sidebar: section titles + sub-headings, with level for styling
type OutlineItem = { id: string; title: string; level: "section" | "sub" };
function getOutlineItems(sections: Section[]): OutlineItem[] {
  return sections.flatMap((sec) => {
    const bodyItems = getBodyItems(sec);
    const subHeads = bodyItems
      .filter((i): i is { type: "h3"; text: string; id: string } => i.type === "h3")
      .map((i) => ({ id: i.id, title: i.text, level: "sub" as const }));
    return [{ id: sec.id, title: sec.title, level: "section" as const }, ...subHeads];
  });
}

// Default headers for 4-column Companies Act / Bill cross-reference table
const COMPANIES_ACT_TABLE_HEADERS = [
  "COMPANIES ACT, 1963 (ACT 179)",
  "COMPANIES BILL, 2018",
  "COMPANIES ACT, 1963 (ACT 179)",
  "COMPANIES BILL, 2018",
];

// Heuristic: content looks like Markdown (headings, bold, lists, etc.)
function isLikelyMarkdown(text: string): boolean {
  if (!text?.trim()) return false;
  const sample = text.slice(0, 4000);
  // # or ## or ### at start of line
  if (/^#{1,6}\s+\S/m.test(sample)) return true;
  // ** or __ for bold
  if (/\*\*[^*]+\*\*|__[^_]+__/.test(sample)) return true;
  // - or * list at line start
  if (/^\s*[-*]\s+\S/m.test(sample)) return true;
  // ``` code fence
  if (/^```/m.test(sample)) return true;
  // [text](url) links
  if (/\[[^\]]+\]\([^)]+\)/.test(sample)) return true;
  return false;
}

// Turn URLs in text into clickable links (e.g. http://www.adie.sn/...)
function linkify(text: string): ReactNode {
  if (!text?.trim()) return text;
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,;:?!)\]]+$/, "");
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="!text-blue-600 font-bold underline decoration-blue-600 hover:decoration-blue-600"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Major headings start a new section (new card). Section and Article stay in the flow as sub-headings so the doc doesn’t fragment.
// Major: Part, Titre, Chapitre, Chapter, markdown ##, Arabic الباب/الفصل. Minor (sub-headings in body): Section, Article, Art., Ingingo, المادة.
function isMajorSectionStart(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Markdown headings: ## Title or ### Subtitle
  if (/^#{1,6}\s+\S/.test(t)) return true;
  // Markdown bold-only line as heading (e.g. **Introduction**)
  if (/^\*\*[^*]+\*\*\s*$/.test(t) || /^__[^_]+__\s*$/.test(t)) return true;
  // "Part D: Administrative...", "Part E: General Provisions"
  if (/^Part\s+[A-Z][.:]?\s+/i.test(t)) return true;
  // "Chapter 1", "Chapter 2." (English)
  if (/^Chapter\s+\d+[.:]?\s*/i.test(t)) return true;
  // French: "Chapitre I", "Chapitre III - POUVOIRS..."
  if (/^Chapitre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*/i.test(t)) return true;
  // French: "Titre I", "Titre II" (Title/Part)
  if (/^Titre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*/i.test(t)) return true;
  // Arabic: الفصل (Chapter), الباب (Part) – major divisions
  if (/^\s*الفصل\s*[\d٠-٩]*/u.test(t)) return true;
  if (/^\s*الباب\s+/u.test(t) || /^\s*الباب\s*[\d٠-٩]/u.test(t)) return true;
  // Standalone topic headings (short, single-word style) – but never "Section" or "Article" (they are sub-headings)
  if (t.length <= 3) return false;
  if (/^[A-Z]{2,3}$/.test(t)) return false;
  if (/^(Section|Article)$/i.test(t)) return false;
  if (/^[A-Z][a-z]+$/.test(t) && t.length < 50) return true;
  return false;
}

// Sub-headings: Section, Article, Art. – shown inside the section body as h3-style lines, not as new cards (include Roman numerals: Section I, Section II)
function isSubHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^Section\s+[\dIVXLCDMivxlcdm]+[.:]?\s*/i.test(t)) return true;
  if (/^Article\s+\d+[.:]?\s*/i.test(t)) return true;
  if (/^Art\.\s*\d+[.:]?\s*/i.test(t)) return true;
  if (/^Ingingo\s+(ya\s+)?\d+[.:]?\s*/i.test(t)) return true;
  if (/^\s*المادة\s*[\d٠-٩]+/u.test(t)) return true;
  return false;
}

// Extract the actual heading from the document for sidebar and section title
function sectionTitle(firstLine: string): string {
  const t = firstLine.trim();
  // Markdown: ## Title or ### Title -> strip # and use rest
  const mdHeading = t.match(/^#{1,6}\s+(.+)$/);
  if (mdHeading) return mdHeading[1].trim();
  // Markdown bold-only: **Introduction** or __Article I__ -> strip markers for sidebar
  const boldStar = t.match(/^\*\*(.+)\*\*\s*$/);
  if (boldStar) return boldStar[1].trim();
  const boldUnder = t.match(/^__(.+)__\s*$/);
  if (boldUnder) return boldUnder[1].trim();
  // Use full line for "Part D: ..." and "356. Meetings of the Board"
  if (/^Part\s+[A-Z]/i.test(t) || /^\d+\.\s+[A-Z]/.test(t)) return t;
  // "Section 20" or "Section 20. Something" -> show as "Section 20" in nav; full line in body
  const sectionMatch = t.match(/^(Section\s+\d+)[.:]?\s*(.*)$/i);
  if (sectionMatch) return sectionMatch[1];
  const articleMatch = t.match(/^(Article\s+\d+)[.:]?\s*(.*)$/i);
  if (articleMatch) return articleMatch[1];
  const artMatch = t.match(/^(Art\.\s*\d+)[.:]?\s*(.*)$/i);
  if (artMatch) return artMatch[1];
  const chapterMatch = t.match(/^(Chapter\s+\d+)[.:]?\s*(.*)$/i);
  if (chapterMatch) return chapterMatch[1];
  const chapitreMatch = t.match(/^(Chapitre\s+[\dIVXLCDMivxlcdm]+)[.:]?\s*(.*)$/i);
  if (chapitreMatch) return chapitreMatch[1];
  const titreMatch = t.match(/^(Titre\s+[\dIVXLCDMivxlcdm]+)[.:]?\s*(.*)$/i);
  if (titreMatch) return titreMatch[1];
  const ingingoMatch = t.match(/^(Ingingo\s+(?:ya\s+)?\d+)[.:]?\s*(.*)$/i);
  if (ingingoMatch) return ingingoMatch[1];
  // Arabic: المادة 1، الفصل ۲، الباب الأول
  const arArticle = t.match(/^(\s*المادة\s*[\d٠-٩]+)[\s.:،]*/u);
  if (arArticle) return arArticle[1].trim();
  const arChapter = t.match(/^(\s*الفصل\s*[\d٠-٩]*)[\s.:،]*/u);
  if (arChapter) return arChapter[1].trim() || t.slice(0, 50);
  const arPart = t.match(/^(\s*الباب\s+[^\n]{0,60})/u);
  if (arPart) return arPart[1].trim();
  return t;
}

// PDF page markers (e.g. "-- 1 of 60 --") – strip so they don't fill the document
function isPageMarker(line: string): boolean {
  const t = line.trim();
  return /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/i.test(t) || /^\s*-\s*\d+\s+of\s+\d+\s*-\s*$/i.test(t) || /^\s*page\s+\d+\s+of\s+\d+\s*$/i.test(t);
}

// OCR noise: symbol-only lines (|, ;, @) and very short all-caps fragments (SI, An, Vv) – hide from display
function isJunkLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^[\s|;@#$%^&*_=+\[\]{}~`\\]+$/.test(t)) return true;
  if (t.length === 1 && /[^\w\s.]/.test(t)) return true;
  if (t.length === 2 && /^[A-Z]{2}$/.test(t)) return true; // "SI", "AN" (OCR junk)
  if (t.length >= 3 && /^[A-Z]+$/.test(t)) return true; // "VV", other all-caps fragments
  return false;
}

// Split content by major headings only (Part, Chapitre, Titre, Chapter). Section and Article stay in body as sub-headings.
function splitIntoSections(text: string): Section[] {
  if (!text?.trim()) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (isMajorSectionStart(line)) {
      if (currentTitle || currentBody.length > 0) {
        sections.push({
          id: `sec-${sections.length}`,
          title: currentTitle || "Introduction",
          body: currentBody.join("\n").trim(),
        });
      }
      currentTitle = sectionTitle(line);
      currentBody = [];
      const t = line.trim();
      // Put any text after the major heading on the same line into body
      const mdHeadingLine = /^(#{1,6}\s+)(.+)$/.exec(t);
      if (mdHeadingLine && mdHeadingLine[2].trim()) {
        currentBody.push(mdHeadingLine[2].trim());
      } else {
        const majorLike =
          /^(Part\s+[A-Z][.:]?\s*)(.*)$/i.exec(t) ||
          /^(Chapter\s+\d+[.:]?\s*)(.*)$/i.exec(t) ||
          /^(Chapitre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*)(.*)$/i.exec(t) ||
          /^(Titre\s+[\dIVXLCDMivxlcdm]+[.:]?\s*)(.*)$/i.exec(t);
        if (majorLike && majorLike[2].trim()) {
          currentBody.push(majorLike[2].trim());
        } else {
          const arChapterLine = /^(\s*الفصل\s*[\d٠-٩]*[\s.:،]*)(.+)$/u.exec(t);
          const arPartLine = /^(\s*الباب\s+[^\n]{0,60}[\s.:،]*)(.+)$/u.exec(t);
          if (arChapterLine && arChapterLine[2].trim()) currentBody.push(arChapterLine[2].trim());
          else if (arPartLine && arPartLine[2].trim()) currentBody.push(arPartLine[2].trim());
        }
      }
    } else {
      // Section, Article, Art. and normal lines all go into body (Section/Article rendered as sub-headings later)
      if (!isPageMarker(line) && !isJunkLine(line)) currentBody.push(line);
    }
  }

  if (currentTitle || currentBody.length > 0) {
    sections.push({
      id: `sec-${sections.length}`,
      title: currentTitle || "Introduction",
      body: currentBody.join("\n").trim(),
    });
  }

  // If no heading-based sections found, fall back to paragraph blocks with generic labels
  if (sections.length === 0) {
    const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
    return blocks.map((body, i) => ({
      id: `sec-${i}`,
      title: `Section ${i + 1}`,
      body: body.trim(),
    }));
  }

  // If we have sections but all bodies are empty (e.g. Arabic OCR), show full text as one section
  const totalBodyLen = sections.reduce((acc, s) => acc + (s.body?.length ?? 0), 0);
  if (totalBodyLen === 0 && text.trim()) {
    return [{ id: "sec-0", title: "النص الكامل / Full text", body: text.trim() }];
  }

  return sections;
}

// Detect if content is primarily Arabic (for RTL display)
function isPrimarilyArabic(text: string): boolean {
  if (!text?.trim()) return false;
  const sample = text.slice(0, 3000);
  const arabic = (sample.match(/[\u0600-\u06FF]/g) || []).length;
  const letters = (sample.match(/\p{L}/gu) || []).length;
  return letters > 0 && arabic / letters >= 0.2;
}

export default function LawDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [law, setLaw] = useState<LawDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [contentsPosition, setContentsPosition] = useState<{ x: number; y: number } | null>(null);
  const [mobileContentsOpen, setMobileContentsOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [summary, setSummary] = useState<{ summary_text: string; generated_at: string } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const contentsRef = useRef<HTMLDivElement>(null);
  const { isSignedIn, user } = useUser();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }, []);

  const handleContentsMouseDown = useCallback((e: React.MouseEvent) => {
    if (!contentsRef.current) return;
    const rect = contentsRef.current.getBoundingClientRect();
    const x = contentsPosition?.x ?? rect.left;
    const y = contentsPosition?.y ?? rect.top;
    dragStartRef.current = { x, y, clientX: e.clientX, clientY: e.clientY };
  }, [contentsPosition]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.clientX;
      const dy = e.clientY - dragStartRef.current.clientY;
      setContentsPosition({
        x: dragStartRef.current.x + dx,
        y: dragStartRef.current.y + dy,
      });
    };
    const onUp = () => { dragStartRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Check if user has team plan
  const isTeamPlan = user?.publicMetadata?.tier === "team" || user?.publicMetadata?.subscriptionTier === "team";
  const isAdmin = (user?.publicMetadata?.role as string | undefined) === "admin";

  // Check bookmark status (fetch with credentials so auth cookie is sent)
  useEffect(() => {
    if (!resolvedId) {
      setIsBookmarked(false);
      return;
    }
    if (!isSignedIn) {
      setIsBookmarked(false);
      return;
    }
    fetch("/api/bookmarks", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { bookmarks?: Array<{ law_id: string }> }) => {
        const bookmarks = data.bookmarks ?? [];
        setIsBookmarked(bookmarks.some((b) => b.law_id === resolvedId));
      })
      .catch(() => setIsBookmarked(false));
  }, [isSignedIn, resolvedId]);

  // Fetch law summary (Team plan only)
  useEffect(() => {
    if (!isTeamPlan || !resolvedId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    fetch(`/api/laws/${resolvedId}/summary`)
      .then((r) => r.json())
      .then((data: { summary?: { summary_text: string; generated_at: string } | null }) => {
        setSummary(data.summary ?? null);
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [isTeamPlan, resolvedId]);

  // Fetch law summary (Team plan only)
  useEffect(() => {
    if (!isTeamPlan || !resolvedId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    fetch(`/api/laws/${resolvedId}/summary`)
      .then((r) => r.json())
      .then((data: { summary?: { summary_text: string; generated_at: string } | null }) => {
        setSummary(data.summary ?? null);
      })
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, [isTeamPlan, resolvedId]);

  const toggleBookmark = async () => {
    if (!isSignedIn || !resolvedId) return;
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await fetch(`/api/bookmarks?law_id=${resolvedId}`, { method: "DELETE" });
        setIsBookmarked(false);
      } else {
        await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ law_id: resolvedId }),
        });
        setIsBookmarked(true);
      }
    } catch {
      // Error handling
    } finally {
      setBookmarkLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    params.then((p) => {
      if (cancelled) return;
      setResolvedId(p.id);
    });
    return () => { cancelled = true; };
  }, [params]);

  useEffect(() => {
    if (!resolvedId) return;
    fetch(`/api/laws/${resolvedId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Law not found");
        return res.json();
      })
      .then((data: LawDetail) => {
        setLaw(data);
        const sections = splitIntoSections(data.content_plain || data.content || "");
        if (sections.length > 0) setActiveSection(sections[0].id);
        try {
          const key = "yamale-library-recently-opened";
          if (typeof window !== "undefined") {
            localStorage.setItem(key, JSON.stringify(resolvedId));
          }
        } catch {
          // ignore
        }
      })
      .catch(() => setError("Could not load this law."))
      .finally(() => setLoading(false));
  }, [resolvedId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !law) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-muted-foreground">{error ?? "Law not found."}</p>
        <Link
          href={returnTo && returnTo.startsWith("/library") ? returnTo : "/library"}
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Library
        </Link>
      </div>
    );
  }

  const rawContent = law.content_plain || law.content || "";
  const sections = splitIntoSections(rawContent);
  const outlineItems = getOutlineItems(sections);
  const hasContent = sections.length > 0;
  const isRtl = isPrimarilyArabic(rawContent);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--primary)/8%,transparent)]">
      <header className="border-b border-border/80 bg-card/80 px-4 py-8 backdrop-blur-md sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link
                href={returnTo && returnTo.startsWith("/library") ? returnTo : "/library"}
                className="group inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted/50 hover:text-foreground"
                title="Back to the African Legal Library"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back to Library
              </Link>
              <h1 className="mt-6 font-extrabold leading-[1.15] tracking-tight text-foreground text-2xl sm:text-3xl md:text-4xl md:tracking-[-0.02em]">
                {law.title}
              </h1>
              <div className="mt-4 flex items-center gap-3" aria-hidden>
                <div className="h-1 w-12 rounded-full bg-primary" />
                <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-primary/60 to-transparent" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasContent && sections.length >= 1 && (
                <button
                  type="button"
                  onClick={() => setMobileContentsOpen(true)}
                  className="lg:hidden shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Open contents"
                  title="Open contents sidebar"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {law.countries?.name && (
              <span className="rounded-full bg-primary/15 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-primary">
                {law.countries.name}
              </span>
            )}
            {law.categories?.name && (
              <span className="rounded-full bg-muted/80 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                {law.categories.name}
              </span>
            )}
            {law.source_url && (
              <a
                href={law.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/80 bg-background/80 px-3.5 py-1.5 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-muted/50"
              >
                Source
              </a>
            )}
          </div>
          {/* Law Summary (Team Plan Only) */}
          {isTeamPlan && (
            <div className="mt-4">
              {summaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading summary...</span>
                </div>
              ) : summary ? (
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-5 shadow-sm">
                  <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wider text-foreground">AI Summary</h3>
                  <p className="text-sm leading-relaxed text-foreground/90">{summary.summary_text}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-5 text-sm text-muted-foreground">
                  <p>No summary available for this law yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Contents drawer */}
      {hasContent && sections.length >= 1 && mobileContentsOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            aria-hidden
            onClick={() => setMobileContentsOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border/80 bg-card/95 shadow-2xl backdrop-blur-xl lg:hidden"
            aria-label="Contents"
          >
            <div className="flex h-14 items-center justify-between border-b border-border/80 bg-muted/20 px-5 backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Contents
              </p>
              <button
                type="button"
                onClick={() => setMobileContentsOpen(false)}
                className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className={`max-h-[calc(100vh-3.5rem)] space-y-0.5 overflow-y-auto p-4 ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : undefined}>
              {outlineItems.map((item) => (
                <li key={item.id} className={item.level === "sub" ? "pl-3" : undefined}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                      setMobileContentsOpen(false);
                    }}
                    className={`block w-full rounded-lg border-l-2 py-2.5 pr-3 text-left transition-all duration-200 ${item.level === "section" ? "pl-3 text-sm font-bold" : "pl-2 text-xs font-medium"} ${isRtl ? "text-right border-l-0 border-r-2 pr-3 pl-3" : ""} ${activeSection === item.id ? "border-primary bg-primary/10 font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                    title={item.title.length > 60 ? item.title : undefined}
                  >
                    <span className="block truncate">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      <div className="min-h-screen bg-gradient-to-b from-muted/10 via-background to-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
          {/* Desktop: sidebar. Mobile: hidden (use hamburger + drawer) */}
          {hasContent && sections.length >= 1 && (
            <nav
              className="hidden shrink-0 lg:block lg:w-60"
              style={contentsPosition ? { position: "fixed", left: contentsPosition.x, top: contentsPosition.y, zIndex: 50, width: "15rem" } : undefined}
              ref={contentsRef}
            >
              <div className="sticky top-24 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-xl shadow-black/[0.06] backdrop-blur-xl dark:bg-card/80 dark:shadow-none dark:ring-1 dark:ring-white/10">
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={handleContentsMouseDown}
                  onDoubleClick={() => setContentsPosition(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                  className="mb-4 flex cursor-grab items-center gap-2.5 active:cursor-grabbing"
                  title="Drag to move. Double-click to reset position."
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/80" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Contents
                  </p>
                </div>
                <ul className={`max-h-[70vh] space-y-0.5 overflow-y-auto ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : undefined}>
                  {outlineItems.map((item) => (
                    <li key={item.id} className={item.level === "sub" ? "pl-3" : undefined}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id);
                          document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`block w-full rounded-xl py-2 pr-3 text-left transition-all duration-200 ${item.level === "section" ? "pl-3 text-sm font-bold" : "pl-2 text-xs font-medium"} ${isRtl ? "text-right pr-3 pl-3" : ""} ${activeSection === item.id ? "bg-primary/12 font-semibold text-primary shadow-sm" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                        title={item.title.length > 50 ? item.title : undefined}
                      >
                        <span className={`block truncate ${item.level === "section" ? "" : "border-s-2 border-primary/30 ps-2"}`}>{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] font-medium tracking-wide text-muted-foreground/70">Drag to move</p>
              </div>
            </nav>
          )}

          <main className="min-w-0 flex-1">
            {!hasContent && (
              <div className="rounded-2xl border border-border bg-muted/20 p-12 text-center shadow-sm">
                <FileText className="mx-auto h-14 w-14 text-muted-foreground/70" />
                <p className="mt-5 text-base text-muted-foreground">
                  Full text for this law is not yet available.
                </p>
                {law.source_url && (
                  <a
                    href={law.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    View source
                  </a>
                )}
              </div>
            )}

            {hasContent && (
              <article className="w-full overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl shadow-black/[0.08] ring-1 ring-black/[0.05] dark:ring-white/10 transition-shadow duration-300 hover:shadow-black/[0.12]" dir={isRtl ? "rtl" : undefined} lang={isRtl ? "ar" : undefined}>
                {/* Accent strip */}
                <div className="h-2 w-full bg-gradient-to-r from-primary via-primary to-amber-500/80" aria-hidden />
                <div className={`mx-auto w-full max-w-4xl px-6 py-8 sm:px-12 sm:py-10 md:px-16 md:py-14 ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : undefined} lang={isRtl ? "ar" : undefined}>
                  {sections.map((sec) => (
                    <section key={sec.id} id={sec.id} className="scroll-mt-24 border-b border-border/40 pb-14 last:border-0 last:pb-0">
                      {/* Level 1: Section / Chapter – big, bold, primary accent */}
                      <h2 className="mb-8 mt-14 border-s-4 border-primary bg-gradient-to-r from-primary/12 to-primary/5 py-4 ps-6 first:mt-0 sm:ps-7">
                        <span className="text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.65rem]">
                          {sec.title}
                        </span>
                      </h2>
                      {isLikelyMarkdown(sec.body) ? (
                        <div className="prose prose-lg max-w-none leading-relaxed text-foreground dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-p:leading-[1.75] prose-p:text-foreground/90 prose-li:text-foreground">
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
                            }}
                          >
                            {sec.body}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <>
                          {getBodyItems(sec).map((item, bi) =>
                            item.type === "table" ? (
                              <div key={bi} className="my-8 overflow-x-auto rounded-xl border border-border/80 shadow-sm">
                                <table className="w-full min-w-[400px] border-collapse text-sm">
                                  <thead>
                                    <tr>
                                      {item.rows[0].length === 4
                                        ? COMPANIES_ACT_TABLE_HEADERS.map((h, j) => (
                                            <th key={j} className="border-b border-border bg-muted/40 px-4 py-3 text-left font-semibold text-foreground">
                                              {h}
                                            </th>
                                          ))
                                        : item.rows[0].map((_, j) => (
                                            <th key={j} className="border-b border-border bg-muted/40 px-4 py-3 text-left font-semibold text-foreground">
                                              Col {j + 1}
                                            </th>
                                          ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.rows.map((row, ri) => (
                                      <tr key={ri} className="transition-colors hover:bg-muted/20">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="border-b border-border/60 px-4 py-3 text-center last:border-b-0">
                                            {linkify(cell)}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : item.type === "h3" ? (
                              <h3
                                key={bi}
                                id={item.id}
                                className="mt-8 mb-4 scroll-mt-24 border-s-2 border-primary/50 ps-4 text-[1.0625rem] font-semibold tracking-tight text-foreground/95 first:mt-0 sm:ps-5"
                              >
                                {linkify(item.text)}
                              </h3>
                            ) : (
                              <p key={bi} className="mb-5 pl-0 text-[1.0625rem] leading-[1.8] text-foreground/85 last:mb-0 sm:pl-0">
                                {linkify(item.text)}
                              </p>
                            )
                          )}
                        </>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            )}
          </main>
          </div>
        </div>
      </div>

      {hasContent && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-1 rounded-2xl border border-border/80 bg-card/90 p-2 shadow-xl shadow-black/10 backdrop-blur-xl">
          {/* Back to Library */}
          <div className="relative group">
            <Link
              href={returnTo && returnTo.startsWith("/library") ? returnTo : "/library"}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Back to Library"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
              Back to Library
            </span>
          </div>

          {/* Edit (admins only) */}
          {isAdmin && (
            <div className="relative group">
              <Link
                href={`/admin-panel/laws/${law.id}`}
                className="inline-flex items-center justify-center rounded-md p-2 text-primary hover:bg-primary/10"
                aria-label="Edit law"
              >
                <FileEdit className="h-5 w-5" />
              </Link>
              <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
                Edit law (admin)
              </span>
            </div>
          )}

          {/* Bookmark toggle */}
          <div className="relative group">
            <button
              type="button"
              onClick={isSignedIn ? toggleBookmark : () => window.location.assign("/sign-in?redirect_url=" + encodeURIComponent(window.location.pathname))}
              disabled={bookmarkLoading}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
              aria-label={isSignedIn ? (isBookmarked ? "Remove bookmark" : "Add bookmark") : "Sign in to bookmark"}
            >
              {isSignedIn && isBookmarked ? (
                <BookmarkCheck className="h-5 w-5 fill-current text-primary" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </button>
            <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
              {isSignedIn ? (isBookmarked ? "Remove bookmark" : "Add bookmark") : "Sign in to bookmark"}
            </span>
          </div>

          <div className="my-0.5 h-px bg-border" />

          {/* Scroll controls */}
          <div className="relative group">
            <button
              type="button"
              onClick={scrollToTop}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
              Scroll to top
            </span>
          </div>
          <div className="relative group">
            <button
              type="button"
              onClick={scrollToBottom}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
            <span className="pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 rounded bg-black/80 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition group-hover:opacity-100">
              Scroll to bottom
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
