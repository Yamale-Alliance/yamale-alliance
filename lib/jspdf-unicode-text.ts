/**
 * Unicode / Arabic helpers for client-side jsPDF exports.
 * Helvetica cannot render Arabic; embed Noto Sans Arabic and reshape glyphs for joining.
 */

import type { jsPDF } from "jspdf";
import { ArabicShaper } from "arabic-persian-reshaper";

const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const FONT_FILE = "NotoSansArabic-Regular.ttf";
const FONT_NAME = "NotoSansArabic";
const NOTO_ARABIC_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf";

const registeredDocs = new WeakSet<jsPDF>();
let fontBase64: string | null = null;
let fontLoadPromise: Promise<void> | null = null;

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (fontBase64) return fontBase64;
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const res = await fetch(NOTO_ARABIC_URL);
      if (!res.ok) throw new Error(`Arabic PDF font fetch failed (${res.status})`);
      fontBase64 = arrayBufferToBase64(await res.arrayBuffer());
    })();
  }
  await fontLoadPromise;
  if (!fontBase64) throw new Error("Arabic PDF font unavailable");
  return fontBase64;
}

/** Register Noto Sans Arabic on this jsPDF instance (once per document). */
export async function ensureNotoArabicFont(doc: jsPDF): Promise<void> {
  if (registeredDocs.has(doc)) return;
  const b64 = await loadFontBase64();
  doc.addFileToVFS(FONT_FILE, b64);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  doc.addFont(FONT_FILE, FONT_NAME, "bold");
  registeredDocs.add(doc);
}

/** Presentation forms + visual order for jsPDF (logical Arabic → readable glyphs). */
export function prepareArabicForPdf(text: string): string {
  if (!containsArabicScript(text)) return text;
  try {
    const shaped = ArabicShaper.convertArabic(text);
    return shaped.split("").reverse().join("");
  } catch {
    return text;
  }
}

export function prepareTextForPdf(text: string): string {
  return prepareArabicForPdf(text);
}

export function applyPdfFontForText(
  doc: jsPDF,
  text: string,
  style: "normal" | "bold" | "italic" = "normal"
): { usesArabicFont: boolean } {
  const usesArabicFont = containsArabicScript(text);
  if (usesArabicFont) {
    doc.setFont(FONT_NAME, style === "bold" ? "bold" : "normal");
  } else {
    doc.setFont("helvetica", style === "bold" ? "bold" : style === "italic" ? "italic" : "normal");
  }
  return { usesArabicFont };
}

export type PdfWrappedTextOptions = {
  fontSizePt: number;
  style?: "normal" | "bold" | "italic";
  maxWidthMm: number;
  x: number;
  y: number;
  maxY: number;
  ensureSpace: (y: number, needed: number) => number;
};

/** Draw wrapped plain text with correct font and RTL for Arabic segments. */
export function writePdfWrappedText(doc: jsPDF, rawText: string, opts: PdfWrappedTextOptions): number {
  const style = opts.style ?? "normal";
  const prepared = prepareTextForPdf(rawText);
  const { usesArabicFont } = applyPdfFontForText(doc, rawText, style);
  doc.setFontSize(opts.fontSizePt);
  const lh = (opts.fontSizePt * 1.22 * 25.4) / 72;
  const lines = doc.splitTextToSize(prepared, opts.maxWidthMm) as string[];
  let cy = opts.y;
  const textX = usesArabicFont ? opts.x + opts.maxWidthMm : opts.x;
  for (const line of lines) {
    cy = opts.ensureSpace(cy, lh);
    doc.text(line, textX, cy, {
      align: usesArabicFont ? "right" : "left",
      maxWidth: opts.maxWidthMm,
    });
    cy += lh;
  }
  return cy;
}

export function measurePdfWrappedHeight(
  doc: jsPDF,
  rawText: string,
  maxWidthMm: number,
  fontSizePt: number
): number {
  const prepared = prepareTextForPdf(rawText);
  applyPdfFontForText(doc, rawText, "normal");
  doc.setFontSize(fontSizePt);
  const lh = (fontSizePt * 1.22 * 25.4) / 72;
  const lines = doc.splitTextToSize(prepared, maxWidthMm) as string[];
  return lines.length * lh;
}
