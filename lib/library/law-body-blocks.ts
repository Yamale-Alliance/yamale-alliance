/**
 * Parse law section bodies into paragraphs and tables (numeric rows + Markdown pipe tables).
 * Shared with PDF export so tables are not dumped as raw pipe text.
 */

export type LawBodyBlock = { type: "paragraph"; text: string } | { type: "table"; rows: string[][] };

function isTableRow(line: string): { cells: string[] } | null {
  const t = line.trim();
  if (!t) return null;
  const cells = t.split(/\s+/).filter(Boolean);
  if (cells.length < 2) return null;
  const allCellLike = cells.every((c) => /^\d+$/.test(c) || c === "-");
  return allCellLike ? { cells } : null;
}

function isMarkdownTableLine(line: string): boolean {
  const t = line.trim();
  if (!t || !t.includes("|")) return false;
  const cells = t
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  return cells.length >= 2;
}

function parseMarkdownTableLine(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
}

function isMarkdownTableSeparatorRow(cells: string[]): boolean {
  return cells.length >= 1 && cells.every((c) => /^-+$/.test(c.trim()));
}

/** Split section body into alternating prose and table blocks (same rules as law page `parseBodyBlocks`). */
export function parseLawBodyBlocks(body: string): LawBodyBlock[] {
  if (!body?.trim()) return [];
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: LawBodyBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const rowResult = isTableRow(line);
    if (rowResult) {
      const rows: string[][] = [rowResult.cells];
      const colCount = rowResult.cells.length;
      i++;
      while (i < lines.length) {
        const next = isTableRow(lines[i]!);
        if (!next || next.cells.length !== colCount) break;
        rows.push(next.cells);
        i++;
      }
      if (rows.length >= 1) blocks.push({ type: "table", rows });
      continue;
    }
    if (isMarkdownTableLine(line)) {
      const rows: string[][] = [];
      let colCount = 0;
      while (i < lines.length && isMarkdownTableLine(lines[i]!)) {
        const cells = parseMarkdownTableLine(lines[i]!);
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
    const paraLines: string[] = [];
    while (i < lines.length && !isTableRow(lines[i]!) && !isMarkdownTableLine(lines[i]!)) {
      paraLines.push(lines[i]!);
      i++;
    }
    const text = paraLines.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
  }
  return blocks;
}
