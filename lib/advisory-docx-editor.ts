/** Guards in-document editing: template text cannot be deleted; user additions can. */

const BASELINE = "data-baseline-text";

/** Bracket placeholders and blanks may be fully replaced. */
export function isPlaceholderBaseline(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return /^\[[^\]]*\]$/.test(t) || /^x+$/i.test(t) || /^_{2,}$/.test(t) || /^\.{3,}$/.test(t);
}

const BLOCK_SELECTOR =
  ".docx-wrapper p, .docx-wrapper td, .docx-wrapper th, .docx-wrapper h1, .docx-wrapper h2, .docx-wrapper h3, .docx-wrapper h4, .docx-wrapper h5, .docx-wrapper h6, .docx-wrapper li";

export function collectTemplateBaselines(root: HTMLElement): string[] {
  const lines: string[] = [];
  root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach((el) => {
    const text = el.textContent ?? "";
    if (text.trim()) lines.push(text);
  });
  return lines;
}

/** Re-apply template baselines after loading a saved draft HTML. */
export function applyTemplateBaselinesToDraft(root: HTMLElement, baselines: string[]): void {
  const blocks = root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR);
  blocks.forEach((el, i) => {
    const base = baselines[i];
    if (base === undefined) return;
    el.dataset.baselineText = base;
    const current = el.textContent ?? "";
    if (isPlaceholderBaseline(base)) {
      el.dataset.userSuffix = "";
      return;
    }
    el.dataset.userSuffix = current.startsWith(base) ? current.slice(base.length) : "";
  });
}

/** Mark block-level docx nodes so template copy is append-only (except placeholders). */
export function markTemplateBaseline(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach((el) => {
    const text = el.textContent ?? "";
    if (!text.trim()) return;
    if (el.dataset.baselineText !== undefined) return;
    el.dataset.baselineText = text;
    el.dataset.userSuffix = "";
  });
}

function getBlockFromNode(node: Node): HTMLElement | null {
  const el =
    node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : null;
  if (!el) return null;
  return el.closest<HTMLElement>(`[${BASELINE}]`);
}

function selectionTouchesProtectedBaseline(): boolean {
  const sel = window.getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return false;

  const range = sel.getRangeAt(0);
  const blocks = new Set<HTMLElement>();

  const collect = (node: Node) => {
    const block = getBlockFromNode(node);
    if (block?.dataset.baselineText && !isPlaceholderBaseline(block.dataset.baselineText)) {
      blocks.add(block);
    }
  };

  collect(range.startContainer);
  collect(range.endContainer);

  for (const block of blocks) {
    const base = block.dataset.baselineText ?? "";
    const current = block.textContent ?? "";
    const suffix = block.dataset.userSuffix ?? "";
    const protectedEnd = base.length;
    const startOffset = offsetInBlock(block, range.startContainer, range.startOffset);
    const endOffset = offsetInBlock(block, range.endContainer, range.endOffset);
    if (startOffset < protectedEnd || endOffset < protectedEnd) {
      if (suffix.length === 0 && startOffset < protectedEnd) return true;
      if (startOffset < protectedEnd) return true;
    }
  }
  return false;
}

function offsetInBlock(block: HTMLElement, container: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(container, offset);
  return r.toString().length;
}

function enforceBlockBaseline(block: HTMLElement): boolean {
  const base = block.dataset.baselineText ?? "";
  if (!base || isPlaceholderBaseline(base)) return false;

  const current = block.textContent ?? "";
  if (current.startsWith(base)) {
    block.dataset.userSuffix = current.slice(base.length);
    return false;
  }

  const suffix = block.dataset.userSuffix ?? "";
  block.textContent = base + suffix;
  return true;
}

export function enforceAllTemplateBaselines(root: HTMLElement): boolean {
  let changed = false;
  root.querySelectorAll<HTMLElement>(`[${BASELINE}]`).forEach((block) => {
    if (enforceBlockBaseline(block)) changed = true;
  });
  return changed;
}

type SavedSelection = {
  block: HTMLElement;
  offset: number;
};

function saveSelection(root: HTMLElement): SavedSelection | null {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const block = getBlockFromNode(range.startContainer);
  if (!block || !root.contains(block)) return null;
  return { block, offset: offsetInBlock(block, range.startContainer, range.startOffset) };
}

function restoreSelection(saved: SavedSelection | null) {
  if (!saved) return;
  const { block, offset } = saved;
  const textNode = firstTextNode(block);
  if (!textNode) return;
  const len = textNode.textContent?.length ?? 0;
  const o = Math.min(offset, len);
  const range = document.createRange();
  range.setStart(textNode, o);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function firstTextNode(el: HTMLElement): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}

export function attachTemplateEditGuards(root: HTMLElement): () => void {
  if (!root.querySelector(`[${BASELINE}]`)) {
    markTemplateBaseline(root);
  }

  const onBeforeInput = (e: InputEvent) => {
    const t = e.inputType;
    if (!t.startsWith("delete") && t !== "insertFromPaste" && t !== "insertReplacementText") return;
    if (selectionTouchesProtectedBaseline()) {
      e.preventDefault();
    }
  };

  const onInput = () => {
    const saved = saveSelection(root);
    const changed = enforceAllTemplateBaselines(root);
    if (changed) restoreSelection(saved);
  };

  root.addEventListener("beforeinput", onBeforeInput);
  root.addEventListener("input", onInput);
  return () => {
    root.removeEventListener("beforeinput", onBeforeInput);
    root.removeEventListener("input", onInput);
  };
}
