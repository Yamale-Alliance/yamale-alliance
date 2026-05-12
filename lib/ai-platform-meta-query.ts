/**
 * Detects questions about the Yamalé product / UI / onboarding rather than
 * substantive legal research. Used to skip RAG and avoid misleading "Sources"
 * lists of unrelated statutes.
 */
export function isPlatformGuideMetaQuery(raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (q.length < 12 || q.length > 2000) return false;

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
