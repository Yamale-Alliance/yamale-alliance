/**
 * Client-side PDF export for AI Research chats — plain text (no markdown), Yamalé branding.
 * Supports Arabic via embedded Noto Sans Arabic + glyph reshaping.
 */

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { loadImageAsDataUrl } from "@/lib/afcfta-report-pdf";
import { plainTextForAiChatExport } from "@/lib/ai-chat-plain-text";
import { formatAssistantAnswerForDisplay, type DocTitleBySlot } from "@/lib/ai-citation-verify";
import { parseLawBodyBlocks } from "@/lib/library/law-body-blocks";
import { plainTextFromMarkdownish } from "@/lib/library/law-document-pdf";
import {
  containsArabicScript,
  ensureNotoArabicFont,
  measurePdfWrappedHeight,
  prepareTextForPdf,
  writePdfWrappedText,
} from "@/lib/jspdf-unicode-text";
import { sanitizeForPdfFont } from "@/lib/pdf-latin-sanitize";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const MAX_Y = PAGE_H - MARGIN - 10;

const NAVY: [number, number, number] = [13, 27, 42];
const GOLD: [number, number, number] = [193, 140, 67];
const MUTED: [number, number, number] = [95, 95, 95];
const USER_BG: [number, number, number] = [255, 253, 248];
const AI_BG: [number, number, number] = [248, 247, 245];

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

export type AiResearchChatPdfMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  sourceCards?: DocTitleBySlot[];
};

export type AiResearchChatPdfInput = {
  title: string;
  messages: AiResearchChatPdfMessage[];
  generatedAt?: Date;
};

/** One assistant reply per user turn; merge duplicate user lines and keep the latest assistant. */
export function collapseMessagesForPdfExport(
  messages: AiResearchChatPdfMessage[]
): AiResearchChatPdfMessage[] {
  const out: AiResearchChatPdfMessage[] = [];
  let i = 0;
  while (i < messages.length) {
    if (messages[i]!.role !== "user") {
      if (messages[i]!.role === "assistant") out.push(messages[i]!);
      i++;
      continue;
    }

    const userText = messages[i]!.content.trim();
    let userMsg = messages[i]!;
    i++;
    while (
      i < messages.length &&
      messages[i]!.role === "user" &&
      messages[i]!.content.trim() === userText
    ) {
      userMsg = messages[i]!;
      i++;
    }

    const prev = out[out.length - 1];
    const isRepeatUser =
      prev?.role === "user" && prev.content.trim() === userText;
    if (!isRepeatUser) {
      out.push(userMsg);
    }

    let lastAssistant: AiResearchChatPdfMessage | null = null;
    while (i < messages.length && messages[i]!.role === "assistant") {
      lastAssistant = messages[i]!;
      i++;
    }
    if (!lastAssistant) continue;

    const tail = out[out.length - 1];
    if (tail?.role === "assistant") {
      out[out.length - 1] = lastAssistant;
    } else {
      out.push(lastAssistant);
    }
  }
  return out;
}

function safePdfFilename(title: string): string {
  const base = title
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 72)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${base || "ai-research"}-${date}.pdf`;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= MAX_Y) return y;
  doc.addPage();
  return MARGIN;
}

function wrapOpts(
  doc: jsPDF,
  x: number,
  y: number,
  maxWidthMm: number,
  fontSizePt: number,
  style: "normal" | "bold" | "italic" = "normal"
) {
  return {
    fontSizePt,
    style,
    maxWidthMm,
    x,
    y,
    maxY: MAX_Y,
    ensureSpace: (cy: number, needed: number) => ensureSpace(doc, cy, needed),
  };
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidthMm: number,
  fontSizePt: number,
  style: "normal" | "bold" | "italic" = "normal"
): number {
  return writePdfWrappedText(doc, text, wrapOpts(doc, x, y, maxWidthMm, fontSizePt, style));
}

function addPageFooters(doc: jsPDF): void {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont(containsArabicScript("Yamalé") ? "NotoSansArabic" : "helvetica", "normal");
    doc.setTextColor(...MUTED);
    const footer = prepareTextForPdf(`Yamalé AI · Legal Research · Page ${i} of ${n}`);
    doc.text(footer, PAGE_W / 2, FOOTER_Y, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }
}

async function resolveLogoDataUrl(): Promise<string> {
  try {
    const r = await fetch("/api/admin/platform-settings");
    if (!r.ok) return "";
    const j = (await r.json()) as { logoUrl?: string | null };
    const url = typeof j.logoUrl === "string" && j.logoUrl.trim() ? j.logoUrl.trim() : "";
    if (!url) return "";
    return loadImageAsDataUrl(url);
  } catch {
    return "";
  }
}

function stripCell(cell: string): string {
  return sanitizeForPdfFont(plainTextFromMarkdownish(cell.trim()));
}

function drawMessageBody(
  doc: jsPDF,
  y: number,
  textX: number,
  innerW: number,
  rawContent: string
): number {
  const blocks = parseLawBodyBlocks(rawContent);
  let cy = y;

  if (blocks.length === 0) {
    const plain = plainTextForAiChatExport(rawContent);
    if (!plain) return cy;
    doc.setTextColor(30, 30, 30);
    return writeWrapped(doc, plain, textX, cy, innerW, 10) + 2;
  }

  for (const block of blocks) {
    if (block.type === "paragraph") {
      const p = plainTextForAiChatExport(block.text);
      if (!p) continue;
      doc.setTextColor(30, 30, 30);
      cy = writeWrapped(doc, p, textX, cy, innerW, 10) + 3;
      continue;
    }

    const rows = block.rows.map((r) => r.map((c) => stripCell(c)));
    if (rows.length === 0) continue;

    cy = ensureSpace(doc, cy, 20);
    const hasHeader = rows.length >= 2;
    const head = hasHeader ? [rows[0]!] : undefined;
    const bodyRows = hasHeader ? rows.slice(1) : rows;

    autoTable(doc, {
      startY: cy,
      head,
      body: bodyRows,
      theme: "striped",
      margin: { left: textX, right: PAGE_W - MARGIN - innerW - (textX - MARGIN) },
      tableWidth: innerW,
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 1.5,
        overflow: "linebreak",
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [244, 241, 235],
        textColor: NAVY,
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      tableLineColor: [210, 210, 210],
      tableLineWidth: 0.1,
    });

    cy = (doc as DocWithAutoTable).lastAutoTable.finalY + 5;
  }

  return cy;
}

function estimateMessageBodyHeight(doc: jsPDF, innerW: number, rawContent: string): number {
  const blocks = parseLawBodyBlocks(rawContent);
  if (blocks.length === 0) {
    const plain = plainTextForAiChatExport(rawContent);
    return plain ? measurePdfWrappedHeight(doc, plain, innerW, 10) + 2 : 0;
  }

  let h = 0;
  for (const block of blocks) {
    if (block.type === "paragraph") {
      const p = plainTextForAiChatExport(block.text);
      if (p) h += measurePdfWrappedHeight(doc, p, innerW, 10) + 3;
    } else {
      const rowCount = block.rows.length;
      h += Math.max(12, rowCount * 5 + 8);
    }
  }
  return h;
}

function drawMessageBlock(
  doc: jsPDF,
  y: number,
  role: "user" | "assistant",
  content: string,
  sources?: string[],
  sourceCards?: DocTitleBySlot[]
): number {
  const label = role === "user" ? "Your question" : "Yamalé AI";
  if (!content?.trim() && (!sources || sources.length === 0)) return y;

  const bodyContent =
    role === "assistant" ? formatAssistantAnswerForDisplay(content, sourceCards) : content;

  const blockPad = 4;
  const innerW = CONTENT_W - blockPad * 2 - 3;
  const labelH = 6;
  let contentH = bodyContent?.trim() ? estimateMessageBodyHeight(doc, innerW, bodyContent) + 2 : 0;
  if (sources?.length) {
    contentH += 4;
    for (const src of sources.slice(0, 12)) {
      contentH +=
        measurePdfWrappedHeight(
          doc,
          sanitizeForPdfFont(plainTextFromMarkdownish(src)),
          innerW,
          8
        ) + 1;
    }
    if (sources.length > 12) contentH += 5;
  }
  const blockH = blockPad * 2 + labelH + contentH;
  const useShadedBox = blockH <= MAX_Y - MARGIN * 2;
  y = ensureSpace(doc, y, useShadedBox ? Math.min(blockH, 28) : 12);

  const blockTop = y;
  if (!useShadedBox) {
    y = writeWrapped(doc, label, MARGIN, y, CONTENT_W, 9, "bold") + (labelH - 6);
    if (bodyContent?.trim()) {
      y = drawMessageBody(doc, y, MARGIN, CONTENT_W, bodyContent);
    }
    if (sources?.length) {
      y = writeWrapped(doc, "Sources consulted", MARGIN, y, CONTENT_W, 8, "bold") + 1;
      sources.slice(0, 12).forEach((src, idx) => {
        y =
          writeWrapped(
            doc,
            sanitizeForPdfFont(plainTextFromMarkdownish(`${idx + 1}. ${src}`)),
            MARGIN,
            y,
            CONTENT_W,
            8
          ) + 1;
      });
    }
    return y + 4;
  }

  doc.setFillColor(...(role === "user" ? USER_BG : AI_BG));
  doc.setDrawColor(220, 218, 212);
  doc.setLineWidth(0.15);
  doc.roundedRect(MARGIN, blockTop, CONTENT_W, blockH, 1.5, 1.5, "FD");

  doc.setFillColor(...(role === "user" ? GOLD : NAVY));
  doc.rect(MARGIN, blockTop, 2.2, blockH, "F");

  y = blockTop + blockPad;
  const textX = MARGIN + blockPad + 2.5;

  doc.setTextColor(...(role === "user" ? GOLD : NAVY));
  y = writeWrapped(doc, label, textX, y, innerW, 9, "bold");
  y += 2;

  if (bodyContent?.trim()) {
    y = drawMessageBody(doc, y, textX, innerW, bodyContent);
  }

  if (sources && sources.length > 0) {
    doc.setTextColor(...MUTED);
    y = writeWrapped(doc, "Sources consulted", textX, y, innerW, 8, "bold") + 1;
    doc.setTextColor(30, 30, 30);
    sources.slice(0, 12).forEach((src, idx) => {
      const line = sanitizeForPdfFont(plainTextFromMarkdownish(`${idx + 1}. ${src}`));
      y = writeWrapped(doc, line, textX, y, innerW, 8) + 1;
    });
    if (sources.length > 12) {
      y = writeWrapped(doc, `… and ${sources.length - 12} more source(s).`, textX, y, innerW, 8);
    }
  }

  return blockTop + blockH + 5;
}

export async function buildAiResearchChatPdfBlob(input: AiResearchChatPdfInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  await ensureNotoArabicFont(doc);

  let y = MARGIN;
  const generated = input.generatedAt ?? new Date();
  const dateLabel = generated.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const logoDataUrl = await resolveLogoDataUrl();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN, y, 48, 12);
      y += 16;
    } catch {
      y = writeWrapped(doc, "Yamalé", MARGIN, y, CONTENT_W, 14, "bold") + 2;
    }
  } else {
    y = writeWrapped(doc, "Yamalé", MARGIN, y, CONTENT_W, 14, "bold") + 2;
  }

  doc.setTextColor(...NAVY);
  const title = sanitizeForPdfFont(plainTextFromMarkdownish(input.title || "AI Legal Research"));
  y = writeWrapped(doc, title, MARGIN, y, CONTENT_W, 14, "bold") + 2;

  doc.setTextColor(...MUTED);
  y = writeWrapped(doc, `AI Legal Research · Exported ${dateLabel}`, MARGIN, y, CONTENT_W, 9) + 3;

  doc.setTextColor(110, 110, 110);
  y =
    writeWrapped(
      doc,
      "Indicative research only — not legal advice. Verify with official sources and qualified counsel before relying on this material.",
      MARGIN,
      y,
      CONTENT_W,
      8
    ) + 4;

  doc.setDrawColor(200, 198, 192);
  doc.setLineWidth(0.3);
  y = ensureSpace(doc, y, 4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 8;

  const exportMessages = collapseMessagesForPdfExport(input.messages);
  if (exportMessages.length === 0) {
    doc.setTextColor(...MUTED);
    writeWrapped(doc, "No messages in this conversation.", MARGIN, y, CONTENT_W, 10);
  } else {
    for (const msg of exportMessages) {
      y = drawMessageBlock(doc, y, msg.role, msg.content, msg.sources, msg.sourceCards);
    }
  }

  addPageFooters(doc);
  return doc.output("blob");
}

export async function downloadAiResearchChatPdf(input: AiResearchChatPdfInput): Promise<void> {
  const blob = await buildAiResearchChatPdfBlob(input);
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
