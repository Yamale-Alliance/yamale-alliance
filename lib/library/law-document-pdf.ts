/**
 * Client-side law document PDF (jsPDF) — real text, margins, optional logo, page numbers.
 * Markdown pipe tables and numeric tables are rendered with jspdf-autotable.
 */

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { loadImageAsDataUrl } from "@/lib/afcfta-report-pdf";
import { parseLawBodyBlocks } from "@/lib/library/law-body-blocks";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;

export type LawPdfSection = { title: string; body: string };

export type LawPdfInput = {
  title: string;
  appliesToAllCountries?: boolean;
  countryName?: string | null;
  categoryName?: string | null;
  year?: number | null;
  status?: string | null;
  languageCode?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sections: LawPdfSection[];
  /** Optional; if omitted, fetches `/api/admin/platform-settings`. */
  logoUrl?: string | null;
};

function safePdfFilename(title: string): string {
  const base = title
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 88)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "law-document"}.pdf`;
}

/** Strip common markdown / OCR markers for readable PDF body text. */
export function plainTextFromMarkdownish(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n/g, "\n");
  s = s.replace(/^```[\w-]*\n[\s\S]*?^```/gm, "\n");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/^---+$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function plainSectionTitle(title: string): string {
  const t = title.trim();
  const md = t.match(/^#{1,6}\s+(.+)$/);
  if (md) return plainTextFromMarkdownish(md[1].trim());
  const boldStar = t.match(/^\*\*(.+)\*\*\s*$/);
  if (boldStar) return boldStar[1].trim();
  const boldUnder = t.match(/^__(.+)__\s*$/);
  if (boldUnder) return boldUnder[1].trim();
  return plainTextFromMarkdownish(t);
}

async function resolveLogoUrl(explicit: string | null | undefined): Promise<string | null> {
  if (explicit) return explicit;
  try {
    const r = await fetch("/api/admin/platform-settings");
    if (!r.ok) return null;
    const j = (await r.json()) as { logoUrl?: string | null };
    return typeof j.logoUrl === "string" && j.logoUrl.trim() ? j.logoUrl.trim() : null;
  } catch {
    return null;
  }
}

function imageFormatFromDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (/data:image\/jpeg/i.test(dataUrl)) return "JPEG";
  if (/data:image\/webp/i.test(dataUrl)) return "WEBP";
  return "PNG";
}

function lineHeightMm(doc: jsPDF, fontSizePt: number): number {
  return (fontSizePt * 1.22 * 25.4) / 72;
}

/** Draw wrapped text; returns next baseline y (mm). */
function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidthMm: number,
  fontSizePt: number,
  maxY: number
): number {
  doc.setFontSize(fontSizePt);
  const lh = lineHeightMm(doc, fontSizePt);
  const lines = doc.splitTextToSize(text, maxWidthMm) as string[];
  let cy = y;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (cy + lh > maxY) {
      doc.addPage();
      cy = MARGIN;
    }
    doc.text(line, x, cy);
    cy += lh;
  }
  return cy;
}

function addPageFooters(doc: jsPDF): void {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(95, 95, 95);
    doc.text(`Yamalé Legal Platform · Page ${i} of ${n}`, PAGE_W / 2, FOOTER_Y, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
}

function stripCell(s: string): string {
  return plainTextFromMarkdownish(s.trim());
}

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

function drawBodyBlocks(
  doc: jsPDF,
  y: number,
  body: string,
  maxY: number
): number {
  const blocks = parseLawBodyBlocks(body);
  let cy = y;

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const text = plainTextFromMarkdownish(block.text);
      if (text) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        cy = writeWrapped(doc, text, MARGIN, cy, CONTENT_W, 10, maxY) + 3;
      }
      continue;
    }

    const rows = block.rows.map((r) => r.map((c) => stripCell(c)));
    if (rows.length === 0) continue;

    if (cy > maxY - 25) {
      doc.addPage();
      cy = MARGIN;
    }

    const hasHeader = rows.length >= 2;
    const head = hasHeader ? [rows[0]!] : undefined;
    const bodyRows = hasHeader ? rows.slice(1) : rows;

    autoTable(doc, {
      startY: cy,
      head,
      body: bodyRows,
      theme: "striped",
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 1.5,
        overflow: "linebreak",
        textColor: [20, 20, 20],
      },
      headStyles: {
        fillColor: [244, 241, 235],
        textColor: [13, 27, 42],
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      tableLineColor: [210, 210, 210],
      tableLineWidth: 0.1,
    });

    cy = (doc as DocWithAutoTable).lastAutoTable.finalY + 6;
  }

  return cy;
}

function buildMetaParagraph(input: LawPdfInput): string {
  const parts: string[] = [];
  if (input.appliesToAllCountries) parts.push("Scope: All countries");
  else if (input.countryName) parts.push(`Country: ${input.countryName}`);
  if (input.categoryName) parts.push(`Category: ${input.categoryName}`);
  if (input.languageCode) parts.push(`Language: ${String(input.languageCode).toUpperCase()}`);
  if (input.year != null) parts.push(`Year: ${input.year}`);
  if (input.status) parts.push(`Status: ${input.status}`);
  return parts.join(" · ");
}

export async function buildLawDocumentPdfBlob(input: LawPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const maxY = PAGE_H - MARGIN - 10;
  let y = MARGIN;

  const logoUrl = await resolveLogoUrl(input.logoUrl);
  let logoDataUrl = "";
  if (logoUrl) {
    logoDataUrl = await loadImageAsDataUrl(logoUrl);
  }

  if (logoDataUrl) {
    try {
      const fmt = imageFormatFromDataUrl(logoDataUrl);
      doc.addImage(logoDataUrl, fmt, MARGIN, y, 52, 14);
      y += 18;
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(13, 27, 42);
      doc.text("Yamalé", MARGIN, y + 4);
      y += 10;
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(13, 27, 42);
    doc.text("Yamalé", MARGIN, y + 4);
    y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(13, 27, 42);
  y = writeWrapped(doc, input.title, MARGIN, y, CONTENT_W, 15, maxY) + 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 55);
  const meta = buildMetaParagraph(input);
  if (meta) {
    y = writeWrapped(doc, meta, MARGIN, y, CONTENT_W, 9, maxY) + 2;
  }
  if (input.sourceName || input.sourceUrl) {
    const src = [input.sourceName, input.sourceUrl].filter(Boolean).join(" · ");
    y = writeWrapped(doc, `Source: ${src}`, MARGIN, y, CONTENT_W, 8, maxY) + 2;
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  y = writeWrapped(
    doc,
    "Reference copy only — not legal advice. Verify with official sources or qualified counsel.",
    MARGIN,
    y,
    CONTENT_W,
    8,
    maxY
  );
  y += 4;

  doc.setDrawColor(190, 190, 190);
  if (y + 2 > maxY) {
    doc.addPage();
    y = MARGIN;
  }
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 6;

  doc.setTextColor(20, 20, 20);

  for (const sec of input.sections) {
    const heading = plainSectionTitle(sec.title);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    y = writeWrapped(doc, heading, MARGIN, y, CONTENT_W, 12, maxY) + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const body = sec.body?.trim();
    if (body) {
      y = drawBodyBlocks(doc, y, body, maxY) + 2;
    } else {
      y += 3;
    }
  }

  addPageFooters(doc);
  return doc.output("blob");
}

export async function downloadLawDocumentPdf(input: LawPdfInput): Promise<void> {
  const blob = await buildLawDocumentPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safePdfFilename(input.title);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
