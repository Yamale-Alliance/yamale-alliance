const MAX_LANDING_HTML_CHARS = 500_000;

/** Injected into iframe documents so hash links land below sticky bars and paths like /pricing scroll in-doc. */
const LANDING_BASE_STYLE_MARK = "data-yamale-landing-base";

const LANDING_BASE_CSS =
  "html{scroll-behavior:smooth}[id]{scroll-margin-top:min(5.5rem,14vh)}body{margin:0}";

/**
 * Turns pricing links into same-document anchors so nav stays inside the landing iframe.
 * Root-relative `/pricing` and absolute `https://host/.../pricing` would otherwise load the full Next.js
 * app inside the iframe (“replica” of the site with a loading spinner).
 */
export function rewriteLandingNavAnchors(html: string): string {
  let out = html;
  out = out.replace(
    /\bhref=(["'])https?:\/\/[^"']*?\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  out = out.replace(
    /\bhref=(["'])\/\/[^"']*?\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  out = out.replace(/\bhref=(["'])\/#pricing\1/gi, "href=$1#pricing$1");
  out = out.replace(
    /\bhref=(["'])\/pricing\/?(#(?:[^"']*))?(?:\?[^"']*)?\1/gi,
    (_m, q: string, frag?: string) => (frag ? `href=${q}${frag}${q}` : `href=${q}#pricing${q}`)
  );
  return out;
}

function injectIntoHead(doc: string, snippet: string): string {
  if (/<head[^>]*>/i.test(doc)) {
    return doc.replace(/<head[^>]*>/i, (open) => `${open}${snippet}`);
  }
  return snippet + doc;
}

/**
 * Builds `srcDoc` for the marketplace landing iframe: wraps fragments, ensures viewport meta,
 * adds smooth scrolling / scroll-margin for `#` links, and fixes common `/pricing` href mistakes.
 */
export function prepareMarketplaceLandingSrcDoc(raw: string): string {
  const trimmed = rewriteLandingNavAnchors(raw.trim());
  if (!trimmed) return trimmed;

  const styleTag = `<style ${LANDING_BASE_STYLE_MARK}>${LANDING_BASE_CSS}</style>`;

  if (/^<!doctype/i.test(trimmed)) {
    let doc = trimmed;
    if (!/<meta[^>]*name=["']viewport["']/i.test(doc)) {
      doc = injectIntoHead(
        doc,
        `<meta name="viewport" content="width=device-width, initial-scale=1">`
      );
    }
    if (!new RegExp(LANDING_BASE_STYLE_MARK).test(doc)) {
      doc = injectIntoHead(doc, styleTag);
    }
    return doc;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styleTag}</head><body>${trimmed}</body></html>`;
}

/** Validates admin-submitted HTML for marketplace landing pages. */
export function parseLandingPageHtmlInput(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new Error("landing_page_html must be a string");
  }
  const t = raw.trim();
  if (!t) return null;
  if (t.length > MAX_LANDING_HTML_CHARS) {
    throw new Error(`Landing HTML must be under ${MAX_LANDING_HTML_CHARS.toLocaleString()} characters`);
  }
  return t;
}
