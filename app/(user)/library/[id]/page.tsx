"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, Loader2, GripVertical, ArrowUp, ArrowDown, Menu, X } from "lucide-react";

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

// Parse body into blocks: either table (consecutive table-like rows) or paragraph text
type BodyBlock = { type: "table"; rows: string[][] } | { type: "paragraph"; text: string };
function parseBodyBlocks(body: string): BodyBlock[] {
  const lines = body.split(/\n/);
  const blocks: BodyBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const rowResult = isTableRow(lines[i]);
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
    const paraLines: string[] = [];
    while (i < lines.length && !isTableRow(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    const text = paraLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}

// Default headers for 4-column Companies Act / Bill cross-reference table
const COMPANIES_ACT_TABLE_HEADERS = [
  "COMPANIES ACT, 1963 (ACT 179)",
  "COMPANIES BILL, 2018",
  "COMPANIES ACT, 1963 (ACT 179)",
  "COMPANIES BILL, 2018",
];

// Only major headings start a new section. Numbered provisions (356., 357.) stay in body so all content is shown.
// Includes Arabic headings: المادة (Article), الفصل (Chapter), الباب (Part).
function isSectionStart(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // "Section 20", "Section 21.", "Section 22"
  if (/^Section\s+\d+[.:]?\s*/i.test(t)) return true;
  // "Part D: Administrative...", "Part E: General Provisions"
  if (/^Part\s+[A-Z][.:]?\s+/i.test(t)) return true;
  // "Article 1", "Article 2."
  if (/^Article\s+\d+[.:]?\s*/i.test(t)) return true;
  // "Chapter 1", "Chapter 2."
  if (/^Chapter\s+\d+[.:]?\s*/i.test(t)) return true;
  // Arabic: المادة 1، المادة ۲ (Article), الفصل (Chapter), الباب (Part)
  if (/^\s*المادة\s*[\d٠-٩]+/u.test(t)) return true;
  if (/^\s*الفصل\s*[\d٠-٩]*/u.test(t)) return true;
  if (/^\s*الباب\s+/u.test(t) || /^\s*الباب\s*[\d٠-٩]/u.test(t)) return true;
  // Standalone topic headings: "Lien", "Definitions" – but skip OCR noise (very short or all-caps fragments)
  if (t.length <= 3) return false; // "SI", "An", "Vv" etc.
  if (/^[A-Z]{2,3}$/.test(t)) return false; // "SI", "AN"
  if (/^[A-Z][a-z]+$/.test(t) && t.length < 50) return true;
  return false;
}

// Extract the actual heading from the document for sidebar and section title
function sectionTitle(firstLine: string): string {
  const t = firstLine.trim();
  // Use full line for "Part D: ..." and "356. Meetings of the Board"
  if (/^Part\s+[A-Z]/i.test(t) || /^\d+\.\s+[A-Z]/.test(t)) return t;
  // "Section 20" or "Section 20. Something" -> show as "Section 20" in nav; full line in body
  const sectionMatch = t.match(/^(Section\s+\d+)[.:]?\s*(.*)$/i);
  if (sectionMatch) return sectionMatch[1];
  const articleMatch = t.match(/^(Article\s+\d+)[.:]?\s*(.*)$/i);
  if (articleMatch) return articleMatch[1];
  const chapterMatch = t.match(/^(Chapter\s+\d+)[.:]?\s*(.*)$/i);
  if (chapterMatch) return chapterMatch[1];
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

// Split content using actual headings from the document (Section 20, Part D:, 356. Meetings, Lien, etc.)
function splitIntoSections(text: string): Section[] {
  if (!text?.trim()) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (isSectionStart(line)) {
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
      // Put any text after the heading on the same line into body (e.g. "Section 20. A forfeited share...")
      const sectionLike = /^(Section\s+\d+[.:]?\s*)(.*)$/i.exec(t) || /^(Article\s+\d+[.:]?\s*)(.*)$/i.exec(t) || /^(Chapter\s+\d+[.:]?\s*)(.*)$/i.exec(t);
      if (sectionLike && sectionLike[2].trim()) currentBody.push(sectionLike[2].trim());
      else {
        const arArticleLine = /^(\s*المادة\s*[\d٠-٩]+[\s.:،]*)(.+)$/u.exec(t);
        const arChapterLine = /^(\s*الفصل\s*[\d٠-٩]*[\s.:،]*)(.+)$/u.exec(t);
        if (arArticleLine && arArticleLine[2].trim()) currentBody.push(arArticleLine[2].trim());
        else if (arChapterLine && arChapterLine[2].trim()) currentBody.push(arChapterLine[2].trim());
      }
    } else {
      // Skip page markers and OCR junk (e.g. "|", ";", symbol-only lines)
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
  const dragStartRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const contentsRef = useRef<HTMLDivElement>(null);

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
          href="/library"
          className="mt-4 inline-flex items-center gap-2 text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Library
        </Link>
      </div>
    );
  }

  const rawContent = law.content_plain || law.content || "";
  const sections = splitIntoSections(rawContent);
  const hasContent = sections.length > 0;
  const isRtl = isPrimarilyArabic(rawContent);

  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 px-4 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link
                href="/library"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Back to Library
              </Link>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {law.title}
              </h1>
            </div>
            {hasContent && sections.length > 1 && (
              <button
                type="button"
                onClick={() => setMobileContentsOpen(true)}
                className="lg:hidden shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Open contents"
              >
                <Menu className="h-6 w-6" />
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{law.countries?.name ?? "—"}</span>
            <span>·</span>
            <span>{law.categories?.name ?? "—"}</span>
            {law.source_url && (
              <>
                <span>·</span>
                <a
                  href={law.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Source
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Contents drawer */}
      {hasContent && sections.length > 1 && mobileContentsOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            aria-hidden
            onClick={() => setMobileContentsOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-card shadow-xl lg:hidden"
            aria-label="Contents"
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
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
              {sections.map((sec) => (
                <li key={sec.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection(sec.id);
                      document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
                      setMobileContentsOpen(false);
                    }}
                    className={`block w-full rounded px-3 py-2.5 text-sm ${isRtl ? "text-right" : "text-left"} ${activeSection === sec.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    {sec.title}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Desktop: sidebar. Mobile: hidden (use hamburger + drawer) */}
          {hasContent && sections.length > 1 && (
            <nav
              className="hidden shrink-0 lg:block lg:w-56"
              style={contentsPosition ? { position: "fixed", left: contentsPosition.x, top: contentsPosition.y, zIndex: 50, width: "14rem" } : undefined}
              ref={contentsRef}
            >
              <div className="sticky top-24 rounded-lg border border-border bg-card p-4 shadow-lg">
                <div
                  role="button"
                  tabIndex={0}
                  onMouseDown={handleContentsMouseDown}
                  onDoubleClick={() => setContentsPosition(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
                  className="mb-3 flex cursor-grab items-center gap-2 active:cursor-grabbing"
                  title="Drag to move. Double-click to reset position."
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contents
                  </p>
                </div>
                <ul className={`max-h-[70vh] space-y-1 overflow-y-auto ${isRtl ? "text-right" : ""}`} dir={isRtl ? "rtl" : undefined}>
                  {sections.map((sec) => (
                    <li key={sec.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSection(sec.id);
                          document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`block w-full rounded px-2 py-1.5 text-sm ${isRtl ? "text-right" : "text-left"} ${activeSection === sec.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                      >
                        {sec.title}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground">Drag header to move</p>
              </div>
            </nav>
          )}

          <main className="min-w-0 flex-1">
            {!hasContent && (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">
                  Full text for this law is not yet available.
                </p>
                {law.source_url && (
                  <a
                    href={law.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-primary hover:underline"
                  >
                    View source
                  </a>
                )}
              </div>
            )}

            {hasContent && (
              <div className="space-y-10">
                {sections.map((sec) => (
                  <section
                    key={sec.id}
                    id={sec.id}
                    className="scroll-mt-24 rounded-xl border border-border bg-card p-6"
                    dir={isRtl ? "rtl" : undefined}
                    lang={isRtl ? "ar" : undefined}
                  >
                    <h2 className="mb-4 text-lg font-semibold text-foreground">
                      {sec.title}
                    </h2>
                    <div
                      className={`prose prose-sm max-w-none text-foreground dark:prose-invert ${isRtl ? "text-right" : ""}`}
                      dir={isRtl ? "rtl" : undefined}
                      lang={isRtl ? "ar" : undefined}
                    >
                      {parseBodyBlocks(sec.body).map((block, bi) =>
                        block.type === "table" ? (
                          <div key={bi} className="my-6 overflow-x-auto">
                            <table className="w-full min-w-[400px] border-collapse border border-border text-sm">
                              <thead>
                                <tr>
                                  {block.rows[0].length === 4
                                    ? COMPANIES_ACT_TABLE_HEADERS.map((h, j) => (
                                        <th
                                          key={j}
                                          className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold"
                                        >
                                          {h}
                                        </th>
                                      ))
                                    : block.rows[0].map((_, j) => (
                                        <th
                                          key={j}
                                          className="border border-border bg-muted/50 px-3 py-2 text-left font-semibold"
                                        >
                                          Col {j + 1}
                                        </th>
                                      ))}
                                </tr>
                              </thead>
                              <tbody>
                                {block.rows.map((row, ri) => (
                                  <tr key={ri}>
                                    {row.map((cell, ci) => (
                                      <td
                                        key={ci}
                                        className="border border-border px-3 py-2 text-center"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div key={bi} className="mb-3">
                            {block.text
                              .split(/\n/)
                              .filter((line) => !isPageMarker(line) && !isJunkLine(line))
                              .map((para, pi) => (
                                <p key={pi} className="mb-3 last:mb-0">
                                  {para.trim() || "\u00A0"}
                                </p>
                              ))}
                          </div>
                        )
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {hasContent && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 rounded-lg border border-border bg-card p-1 shadow-lg">
          <button
            type="button"
            onClick={scrollToTop}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Move to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollToBottom}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Move to bottom"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
