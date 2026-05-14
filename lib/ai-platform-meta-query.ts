/**
 * Detects questions about the Yamalé product / UI / onboarding rather than
 * substantive legal research. Used to skip RAG and avoid misleading "Sources"
 * lists of unrelated statutes.
 */
export function isPlatformGuideMetaQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 12 || q.length > 2000) return false;

  /** How the assistant works (retrieval, context) — not substantive law; skip RAG so unrelated laws are not shown as "Sources". */
  const asksRetrievalOrAssistantLimits =
    (/\bwhy\s+(can\s*'?t|cannot|cant)\s+you\s+see\b/.test(q) &&
      /\b(the\s+)?(whole|entire|full)\s+(library|catalog)\b/.test(q)) ||
    /\bhow\s+much\s+of\s+the\s+(library|database|catalog)\b/.test(q) ||
    (/\bwhy\s+(isn'?t|is\s+not)\s+everything\b/.test(q) &&
      /\b(in|from)\s+the\s+library\b/.test(q)) ||
    /\bhow\s+does\b[\s\S]{0,60}\b(retrieval|search\s+results?)\b[\s\S]{0,80}\b(work|function)\b/i.test(raw) ||
    /\bdo\s+you\s+have\s+access\s+to\s+the\s+(whole|entire|full)\s+(library|database|catalog)\b/.test(q);

  if (asksRetrievalOrAssistantLimits) {
    if (/\barticle\s+\d+/i.test(raw) || /\bsection\s+[\dIVXLCDM]+/i.test(raw)) return false;
    return true;
  }

  const mentionsProduct =
    /\b(yamale|yamalé)\b/i.test(raw) ||
    /\b(this|the)\s+platform\b/.test(q) ||
    /\bthis\s+(app|site|tool|service)\b/.test(q) ||
    /\b(the\s+)?legal\s+library\b/.test(q) ||
    /\bai[-\s]?research\b/.test(q) ||
    /\bcette\s+plateforme\b/.test(q) ||
    /\bla\s+plateforme\b/.test(q);

  const asksProductHelp =
    /\bwhat\s+(is|'s|are)\b[\s\S]{0,120}\b(all\s+)?about\b/i.test(q) ||
    /\bwhat\s+is\s+[\s\S]{0,40}\b(this|the|yamal)\w*\s*(platform|product|site|tool|service)\b/i.test(q) ||
    /\bwhat\s+does\b[\s\S]{0,50}\b(do|offer|provide|include)\b/i.test(q) ||
    /\bhow\s+(do|can)\s+i\s+use\b/i.test(q) ||
    /\bhow\s+to\s+use\b/.test(q) ||
    /\bhow\s+does\b[\s\S]{0,30}\bwork\b/i.test(q) ||
    /\babout\s+the\s+platform\b/i.test(q) ||
    /\b(qu'est-ce\s+que|c'est\s+quoi)\b[\s\S]{0,40}\b(la\s+)?(plateforme|yamal)\w*/i.test(q) ||
    /\bcomment\s+(utiliser|ça\s+marche)\b/i.test(q) ||
    (/\b(getting\s+)?started\b/.test(q) && /\bhow\b|\bwhere\b|\bguide\b/.test(q));

  if (!asksProductHelp) return false;

  if (/\barticle\s+\d+/i.test(q) || /\bsection\s+[\dIVXLCDM]+/i.test(q)) return false;

  if (/\bhow\s+(do|can)\s+i\s+use\s+(this|it)\b/i.test(q)) return true;
  if (/\bhow\s+to\s+use\b/.test(q) && mentionsProduct) return true;

  return mentionsProduct;
}
