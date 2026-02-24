/**
 * Build a graphical, modern AfCFTA Compliance Report as PDF (with optional logo).
 * Uses jsPDF + jspdf-autotable; call from browser only.
 */

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

const ORG_PRIMARY = "#c18c43";
const ORG_ACCENT = "#603b1c";
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

// RGB 0-255 for jspdf-autotable fillColor
const accentR = 96;
const accentG = 59;
const accentB = 28;
const primaryR = 193;
const primaryG = 140;
const primaryB = 67;
const lightBg: [number, number, number] = [248, 247, 245];
const zebraBg: [number, number, number] = [250, 250, 250];

export type AfCFTAReportSnapshot = {
  productName: string;
  hsCode: string;
  originCountry: string;
  destCountry: string;
  totalCost: number;
  rvcPercent: number;
  rvcMeetsThreshold: boolean;
  barriers: { title: string; description: string }[];
  mfnRate: number | null;
  afcfta2026: number | null;
  afcfta2030: number | null;
  afcfta2035: number | null;
  totalSavingsBy2035: number | null;
  shipmentValue: string;
  estimatedAnnualSavings: number;
  currentYear: number;
  checklistSections: {
    id: string;
    titleKey: string;
    items: { id: string; title: string; subLabel?: string }[];
  }[];
  checklistProgress: Record<string, boolean>;
  getSectionTitle: (key: "before_export" | "afcfta_docs" | "at_import") => string;
};

/** Load image from URL and return as data URL for embedding in PDF. */
export function loadImageAsDataUrl(url: string): Promise<string> {
  return fetch(url, { mode: "cors" })
    .then((r) => r.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    )
    .catch(() => "");
}

function sectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(title, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

export async function buildAfCFTAReportPdf(
  snapshot: AfCFTAReportSnapshot,
  logoDataUrl: string | null
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // ----- Header bar -----
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN, 5, 35, 18);
    } catch {
      doc.text("AfCFTA Compliance Report", MARGIN, 18);
    }
  } else {
    doc.text("AfCFTA Compliance Report", MARGIN, 18);
  }
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AfCFTA Compliance Report", PAGE_W - MARGIN, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, PAGE_W - MARGIN, 24, { align: "right" });

  y = 36;
  doc.setTextColor(0, 0, 0);

  // ----- 1. Product & trade route TABLE -----
  y = sectionTitle(doc, y, "Product & trade route");
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Product", snapshot.productName || "—"],
      ["HS Code", snapshot.hsCode || "—"],
      ["Exporting from (origin)", snapshot.originCountry || "—"],
      ["Exporting to (destination)", snapshot.destCountry || "—"],
    ],
    theme: "grid",
    headStyles: { fillColor: [accentR, accentG, accentB] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: lightBg },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ----- 2. Production & Origin TABLE -----
  if (y > PAGE_H - 50) {
    doc.addPage();
    y = MARGIN;
  }
  y = sectionTitle(doc, y, "Production & origin");
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Total production cost", `$${snapshot.totalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["RVC (Regional Value Content)", `${snapshot.rvcPercent.toFixed(1)}%`],
      ["AfCFTA RVC threshold (40%)", snapshot.rvcMeetsThreshold ? "Meets threshold" : "Below threshold"],
    ],
    theme: "grid",
    headStyles: { fillColor: [accentR, accentG, accentB] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: lightBg },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ----- 3. Non-Tariff Barriers TABLE -----
  if (y > PAGE_H - 50) {
    doc.addPage();
    y = MARGIN;
  }
  y = sectionTitle(doc, y, "Non-tariff barriers");
  autoTable(doc, {
    startY: y,
    head: [["Requirement", "Description"]],
    body: snapshot.barriers.map((b) => [b.title, b.description]),
    theme: "grid",
    headStyles: { fillColor: [accentR, accentG, accentB] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: zebraBg },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ----- 4. Tariff Savings TABLE -----
  if (y > PAGE_H - 70) {
    doc.addPage();
    y = MARGIN;
  }
  y = sectionTitle(doc, y, "Tariff savings");
  const mfn = snapshot.mfnRate != null ? `${snapshot.mfnRate}%` : "—";
  const a26 = snapshot.afcfta2026 != null ? `${snapshot.afcfta2026}%` : "—";
  const a30 = snapshot.afcfta2030 != null ? `${snapshot.afcfta2030}%` : "—";
  const a35 = snapshot.afcfta2035 != null ? `${snapshot.afcfta2035}%` : "—";
  const totalSav = snapshot.totalSavingsBy2035 != null ? `${snapshot.totalSavingsBy2035}%` : "—";
  autoTable(doc, {
    startY: y,
    head: [["Rate / metric", "Value"]],
    body: [
      ["Standard MFN tariff", mfn],
      ["AfCFTA rate (2026)", a26],
      ["AfCFTA rate (2030)", a30],
      ["AfCFTA rate (2035)", a35],
      ["Total savings by 2035", totalSav],
      ["Shipment value (entered)", snapshot.shipmentValue ? `$${Number(snapshot.shipmentValue.replace(/,/g, "")).toLocaleString()}` : "—"],
      [`Est. annual savings (by ${snapshot.currentYear})`, `$${snapshot.estimatedAnnualSavings.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [accentR, accentG, accentB] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: lightBg },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ----- 5. Compliance Checklist TABLE -----
  if (y > PAGE_H - 40) {
    doc.addPage();
    y = MARGIN;
  }
  y = sectionTitle(doc, y, "Compliance checklist");
  const checklistRows: string[][] = [];
  for (const section of snapshot.checklistSections) {
    const sectionTitleText = snapshot.getSectionTitle(section.titleKey as "before_export" | "afcfta_docs" | "at_import");
    for (const item of section.items) {
      const key = `${section.id}-${item.id}`;
      const checked = snapshot.checklistProgress[key];
      checklistRows.push([
        sectionTitleText,
        item.title,
        item.subLabel || "—",
        checked ? "Done" : "Pending",
      ]);
    }
  }
  autoTable(doc, {
    startY: y,
    head: [["Section", "Item", "Notes", "Status"]],
    body: checklistRows,
    theme: "grid",
    headStyles: { fillColor: [accentR, accentG, accentB] as [number, number, number], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: zebraBg },
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    columnStyles: {
      0: { cellWidth: 42, fontSize: 8 },
      1: { cellWidth: 55, fontStyle: "bold", fontSize: 9 },
      2: { cellWidth: 65, fontSize: 8 },
      3: { cellWidth: 22, fontSize: 9 },
    },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ----- Footer on every page -----
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Page ${i} of ${pageCount}  ·  AfCFTA Compliance Report  ·  ${new Date().toISOString().slice(0, 10)}`,
      PAGE_W / 2,
      PAGE_H - 10,
      { align: "center" }
    );
  }

  return doc.output("blob");
}
