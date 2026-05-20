/**
 * Plain-text conversion for AI Research chat PDF export (markdown → readable prose + tables).
 */

import { parseLawBodyBlocks } from "@/lib/library/law-body-blocks";
import { plainTextFromMarkdownish } from "@/lib/library/law-document-pdf";
import { sanitizeForPdfFont } from "@/lib/pdf-latin-sanitize";

function formatTableAsPlainText(rows: string[][]): string {
  if (rows.length === 0) return "";
  const cleaned = rows.map((row) =>
    row.map((cell) => sanitizeForPdfFont(plainTextFromMarkdownish(cell)))
  );
  const colCount = Math.max(...cleaned.map((r) => r.length));
  const widths = Array.from({ length: colCount }, (_, col) =>
    Math.max(3, ...cleaned.map((r) => (r[col] ?? "").length))
  );

  return cleaned
    .map((row) =>
      Array.from({ length: colCount }, (_, col) => (row[col] ?? "").padEnd(widths[col]!)).join("  ")
    )
    .join("\n");
}

/** Full message body for PDF: paragraphs + ASCII-safe tables (no raw pipe rows). */
export function plainTextForAiChatExport(raw: string): string {
  if (!raw?.trim()) return "";

  const blocks = parseLawBodyBlocks(raw);
  if (blocks.length === 0) {
    return sanitizeForPdfFont(plainTextFromMarkdownish(raw));
  }

  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") {
      const p = sanitizeForPdfFont(plainTextFromMarkdownish(block.text));
      if (p) parts.push(p);
    } else {
      const table = formatTableAsPlainText(block.rows);
      if (table) parts.push(table);
    }
  }

  return parts.join("\n\n").trim();
}
