/** Highlight in-document search matches inside a container (imperative DOM). */

export const LAW_DOC_SEARCH_MARK_CLASS = "law-doc-search-hit";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clearLawDocumentSearchHighlights(root: HTMLElement | null): void {
  if (!root) return;
  root.querySelectorAll(`mark.${LAW_DOC_SEARCH_MARK_CLASS}`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

function wrapMatchesInTextNode(textNode: Text, regex: RegExp): number {
  const text = textNode.nodeValue ?? "";
  regex.lastIndex = 0;
  if (!regex.test(text)) return 0;
  regex.lastIndex = 0;
  const parent = textNode.parentNode;
  if (!parent) return 0;

  const frag = document.createDocumentFragment();
  let lastIndex = 0;
  let count = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : `${regex.flags}g`);
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
    const mark = document.createElement("mark");
    mark.className = LAW_DOC_SEARCH_MARK_CLASS;
    mark.appendChild(document.createTextNode(m[0]));
    frag.appendChild(mark);
    count++;
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  parent.replaceChild(frag, textNode);
  return count;
}

/**
 * Wraps matches in text nodes under `root`. Skips script/style/mark and [data-law-search-skip].
 * Returns total match count. Minimum query length 2.
 */
export function applyLawDocumentSearchHighlights(root: HTMLElement | null, query: string): number {
  clearLawDocumentSearchHighlights(root);
  const q = query.trim();
  if (!root || q.length < 2 || q.length > 200) return 0;

  let regex: RegExp;
  try {
    regex = new RegExp(escapeRegExp(q), "gi");
  } catch {
    return 0;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
      if (p.closest("mark")) return NodeFilter.FILTER_REJECT;
      if (p.closest("[data-law-search-skip]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE && (n as Text).nodeValue?.trim()) textNodes.push(n as Text);
  }

  let total = 0;
  for (const textNode of textNodes) {
    if (!textNode.isConnected) continue;
    if (textNode.parentElement?.closest(`mark.${LAW_DOC_SEARCH_MARK_CLASS}`)) continue;
    const text = textNode.nodeValue ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;
    total += wrapMatchesInTextNode(textNode, regex);
  }
  return total;
}

export function getLawDocumentSearchHitElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll(`mark.${LAW_DOC_SEARCH_MARK_CLASS}`)) as HTMLElement[];
}
