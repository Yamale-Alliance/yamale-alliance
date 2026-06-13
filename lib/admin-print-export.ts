/**
 * Branded HTML print/PDF exports from the admin panel (users, lawyers, etc.).
 */

import { loadImageAsDataUrl } from "@/lib/afcfta-report-pdf";

export const YAMALE_BRAND_NAME = "Yamalé";

export async function resolveAdminExportLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch("/api/admin/platform-settings", { credentials: "include" });
    if (!res.ok) return "";
    const json = (await res.json()) as { logoUrl?: string | null };
    const url = typeof json.logoUrl === "string" && json.logoUrl.trim() ? json.logoUrl.trim() : "";
    if (!url) return "";
    return loadImageAsDataUrl(url);
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type AdminPrintExportHtmlOptions = {
  documentTitle: string;
  reportTitle: string;
  generatedLabel: string;
  footer: string;
  tagline?: string;
  logoDataUrl?: string | null;
  tableHeadHtml: string;
  tableBodyHtml: string;
  summaryLabel?: string;
};

export function buildAdminPrintExportHtml(options: AdminPrintExportHtmlOptions): string {
  const esc = escapeHtml;
  const tagline = options.tagline?.trim();
  const logo = options.logoDataUrl?.trim();
  const summary = options.summaryLabel?.trim();

  const brandBlock = logo
    ? `<img class="brand-logo" src="${logo.replace(/"/g, "&quot;")}" alt="${esc(YAMALE_BRAND_NAME)}" />`
    : `<div class="brand-wordmark">${esc(YAMALE_BRAND_NAME)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(options.documentTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { margin: 16mm 14mm; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 28px 32px 36px;
      color: #1a1a1a;
      font-size: 13px;
      line-height: 1.45;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding-bottom: 18px;
      margin-bottom: 22px;
      border-bottom: 3px solid #c18c43;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }
    .brand-logo {
      display: block;
      max-height: 44px;
      max-width: 180px;
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .brand-wordmark {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #0d1b2a;
    }
    .brand-meta {
      text-align: right;
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 15px;
      font-weight: 700;
      color: #0d1b2a;
      letter-spacing: -0.01em;
    }
    .tagline {
      margin-top: 2px;
      font-size: 11px;
      color: #64748b;
    }
    .report-title {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 700;
      color: #0d1b2a;
      letter-spacing: -0.02em;
    }
    .report-meta {
      margin: 0 0 18px;
      font-size: 12px;
      color: #64748b;
    }
    .summary {
      display: inline-block;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f8f4ee;
      color: #603b1c;
      font-size: 11px;
      font-weight: 600;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    th, td {
      padding: 9px 12px;
      text-align: left;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th {
      background: #0d1b2a;
      color: #fff;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer {
      margin-top: 26px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
      tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      ${brandBlock}
    </div>
    <div class="brand-meta">
      <div class="brand-name">${esc(YAMALE_BRAND_NAME)}</div>
      ${tagline ? `<div class="tagline">${esc(tagline)}</div>` : ""}
    </div>
  </header>
  <h1 class="report-title">${esc(options.reportTitle)}</h1>
  <p class="report-meta">
    ${esc(options.generatedLabel)}
    ${summary ? `<span class="summary">${esc(summary)}</span>` : ""}
  </p>
  <table>
    <thead>${options.tableHeadHtml}</thead>
    <tbody>${options.tableBodyHtml}</tbody>
  </table>
  <div class="footer">${esc(options.footer)}</div>
</body>
</html>`;
}

export function openAdminPrintExport(html: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("popup_blocked");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 150);
  };

  const logo = printWindow.document.querySelector(".brand-logo") as HTMLImageElement | null;
  if (!logo) {
    triggerPrint();
    return;
  }
  if (logo.complete) {
    triggerPrint();
    return;
  }
  logo.onload = triggerPrint;
  logo.onerror = triggerPrint;
}
