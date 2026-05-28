const MAX_LANDING_HTML_CHARS = 500_000;

/** Injected into iframe documents so hash links land below sticky bars and paths like /pricing scroll in-doc. */
const LANDING_BASE_STYLE_MARK = "data-yamale-landing-base";

const LANDING_BASE_CSS =
  "html{scroll-behavior:smooth}[id]{scroll-margin-top:min(5.5rem,14vh)}body{margin:0}";

/** Fallback tokens + CTA styles when :root/body rules do not apply inside shadow DOM. */
const LANDING_SHADOW_ROOT_DEFAULTS = `
.yamale-landing-root{
  --gold:#C18C43;
  --ebony:#1a1410;
  --pale-gold:#E3BA65;
  --white:#faf8f5;
  color:var(--white);
  background:var(--ebony);
  font-family:'DM Sans',sans-serif;
}
.yamale-landing-root .btn-primary{
  background:var(--gold,#C18C43)!important;
  color:var(--ebony,#1a1410)!important;
  font-family:'DM Sans',sans-serif!important;
  font-size:0.875rem!important;
  font-weight:600!important;
  letter-spacing:0.06em!important;
  text-transform:uppercase!important;
  padding:16px 36px!important;
  border:none!important;
  cursor:pointer!important;
  text-decoration:none!important;
  display:inline-block!important;
  transition:all 0.25s!important;
  position:relative!important;
  overflow:hidden!important;
}
.yamale-landing-root .btn-primary:hover{
  transform:translateY(-2px)!important;
  box-shadow:0 8px 32px rgba(193,140,67,0.3)!important;
}
.yamale-landing-root .btn-secondary{
  color:var(--pale-gold,#E3BA65)!important;
  font-family:'DM Sans',sans-serif!important;
  font-size:0.875rem!important;
  font-weight:400!important;
  text-decoration:none!important;
  border-bottom:1px solid rgba(193,140,67,0.4)!important;
  padding-bottom:2px!important;
}
.yamale-landing-root .btn-secondary:hover{
  color:var(--gold,#C18C43)!important;
  border-color:var(--gold,#C18C43)!important;
}
`;

/** Injected inside shadow root only — must not use html/body selectors (would leak in light DOM). */
const LANDING_SHADOW_OVERRIDES_CSS = `
${LANDING_SHADOW_ROOT_DEFAULTS}
nav,.navbar,.site-nav,.top-nav{display:none!important}
nav:has(.lang-selector){
  display:flex!important;
  justify-content:flex-end!important;
  align-items:center!important;
  position:relative!important;
  top:auto!important;
  padding:.75rem 5%!important;
  background:var(--ebony-deep,#161009)!important;
  border-bottom:1px solid rgba(193,140,67,.2)!important;
  z-index:10!important;
}
nav:has(.lang-selector) .nav-brand,
nav:has(.lang-selector) .nav-price,
nav:has(.lang-selector) .nav-cta{display:none!important}
nav:has(.lang-selector) .nav-right{display:flex!important;align-items:center!important;gap:1rem!important}
.hero{position:relative!important;top:auto!important;min-height:min(70vh,720px)!important;padding-top:2rem!important;padding-bottom:3rem!important;margin-top:0!important}
.hero::before,.hero::after{position:absolute!important}
.hero-price-tag{position:absolute!important;top:1rem!important;right:1.5rem!important}
#contents,.kit-section[id="contents"]{scroll-margin-top:1.5rem}
.yamale-landing-root .dtype.guide{color:#603b1c!important}
.yamale-landing-root .dtype.checklist{color:#9a632a!important}
`;

const LANDING_SHADOW_ROOT_CLASS = "yamale-landing-root";

/** Map :root/body/html rules onto the shadow wrapper so variables and base styles apply. */
export function adaptLandingCssForShadow(css: string): string {
  let out = css;
  out = out.replace(/\b:root\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bhtml\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bbody\s*\{/gi, `.${LANDING_SHADOW_ROOT_CLASS}{`);
  out = out.replace(/\bbody::before\b/gi, `.${LANDING_SHADOW_ROOT_CLASS}::before`);
  out = out.replace(/\bbody::after\b/gi, `.${LANDING_SHADOW_ROOT_CLASS}::after`);
  out = out.replace(/position\s*:\s*fixed/gi, "position:relative");
  out = out.replace(/position\s*:\s*sticky/gi, "position:relative");
  return out;
}

/** Rewrites global body/html rules from admin HTML so they do not bleed under the site nav. */
export function scopeLandingCssForEmbed(css: string): string {
  return adaptLandingCssForShadow(css);
}

/** Inline styles from admin HTML must not pin nav to the viewport over Yamalé site chrome. */
function stripViewportFixedInlineStyles(html: string): string {
  return html.replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (_m, quote: string, styles: string) => {
    const cleaned = styles
      .replace(/position\s*:\s*fixed/gi, "position:relative")
      .replace(/top\s*:\s*0(?:px|rem|em|%)?\s*;?/gi, "");
    return `style=${quote}${cleaned}${quote}`;
  });
}

function scopeStyleBlocksInHtml(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, inner) => {
    return `<style${attrs}>${scopeLandingCssForEmbed(inner)}</style>`;
  });
}

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

const CHECKOUT_BRIDGE_SCRIPT = `<script>
(function(){
  var checkoutSel='a[href="#pricing"],a[href="#pricing-standalone"],a[href="#pricing-bundle"],a[href="#lfp-purchase"],a[href="#package-checkout"],a[data-yamale-tier]';
  function detectTier(a){
    if(!a)return null;
    var explicit=a.getAttribute("data-yamale-tier");
    if(explicit==="standalone"||explicit==="bundle")return explicit;
    var card=a.closest&&a.closest(".pricing-card");
    if(card){
      if(card.classList.contains("bundle"))return "bundle";
      if(card.classList.contains("standard"))return "standalone";
    }
    var href=(a.getAttribute("href")||"").toLowerCase();
    if(href.indexOf("#pricing-bundle")>=0||href.indexOf("tier=bundle")>=0)return "bundle";
    if(href.indexOf("#pricing-standalone")>=0||href.indexOf("tier=standalone")>=0)return "standalone";
    if(href.indexOf("mailto:")===0){
      var subject=(href.match(/[?&]subject=([^&]*)/)||[])[1]||"";
      try{subject=decodeURIComponent(subject.replace(/\\+/g," "));}catch(_){}
      if(/bundle|law firm package \\+ zms/i.test(subject))return "bundle";
      if(/zms kit purchase|standalone kit/i.test(subject))return "standalone";
    }
    if(href==="#pricing"||href.indexOf("#pricing")===0){
      var text=(a.textContent||"").toLowerCase();
      if(/bundle|\\$129|law firm package/i.test(text))return "bundle";
      if(/\\$199|standalone|get the kit/i.test(text))return "standalone";
    }
    return null;
  }
  function notifyParent(tier){
    try{window.parent.postMessage({type:"yamale-vault-scroll-checkout",tier:tier||null},"*");}catch(_){}
  }
  function onCheckoutClick(e){
    var a=e.target&&e.target.closest?e.target.closest(checkoutSel):null;
    if(!a)return;
    var tier=detectTier(a);
    var href=(a.getAttribute("href")||"").toLowerCase();
    if(href.indexOf("mailto:")===0){
      if(!tier&&!/purchase|kit|bundle|checkout/i.test(href))return;
      e.preventDefault();
      notifyParent(tier);
      return;
    }
    if(!tier&&href.indexOf("#")!==0)return;
    e.preventDefault();
    notifyParent(tier);
  }
  document.addEventListener("click",onCheckoutClick,true);
})();
</script>`;

function injectBeforeBodyClose(doc: string, snippet: string): string {
  if (/<\/body>/i.test(doc)) {
    return doc.replace(/<\/body>/i, `${snippet}</body>`);
  }
  return doc + snippet;
}

export type PrepareMarketplaceLandingSrcDocOptions = {
  /** When true, purchase CTAs in the iframe scroll the parent page to checkout (ZIP package route). */
  bridgeParentCheckout?: boolean;
};

/**
 * Builds `srcDoc` for the marketplace landing iframe: wraps fragments, ensures viewport meta,
 * adds smooth scrolling / scroll-margin for `#` links, and fixes common `/pricing` href mistakes.
 */
export function prepareMarketplaceLandingSrcDoc(
  raw: string,
  options?: PrepareMarketplaceLandingSrcDocOptions
): string {
  const trimmed = rewriteLandingNavAnchors(raw.trim());
  if (!trimmed) return trimmed;

  const styleTag = `<style ${LANDING_BASE_STYLE_MARK}>${LANDING_BASE_CSS}</style>`;
  const bridge = options?.bridgeParentCheckout ? CHECKOUT_BRIDGE_SCRIPT : "";

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
    if (bridge) {
      doc = injectBeforeBodyClose(doc, bridge);
    }
    return doc;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styleTag}</head><body>${trimmed}${bridge}</body></html>`;
}

import type { PackageOfferTier } from "@/lib/marketplace-package-offers";

export type { PackageOfferTier };

/** Detect standalone vs bundle from a landing-page CTA anchor (shared by iframe bridge and embed). */
export function detectCheckoutTierFromAnchor(anchor: {
  getAttribute(name: string): string | null;
  closest?(selector: string): Element | null;
  textContent?: string | null;
}): PackageOfferTier | null {
  const explicit = anchor.getAttribute("data-yamale-tier");
  if (explicit === "standalone" || explicit === "bundle") return explicit;

  const card = anchor.closest?.(".pricing-card");
  if (card) {
    if (card.classList.contains("bundle")) return "bundle";
    if (card.classList.contains("standard")) return "standalone";
  }

  const href = (anchor.getAttribute("href") || "").toLowerCase();
  if (href.includes("#pricing-bundle") || href.includes("tier=bundle")) return "bundle";
  if (href.includes("#pricing-standalone") || href.includes("tier=standalone")) return "standalone";

  if (href.startsWith("mailto:")) {
    const subjectMatch = href.match(/[?&]subject=([^&]*)/);
    let subject = subjectMatch?.[1] ?? "";
    try {
      subject = decodeURIComponent(subject.replace(/\+/g, " "));
    } catch {
      // keep raw
    }
    if (/bundle|law firm package \+ zms/i.test(subject)) return "bundle";
    if (/zms kit purchase|standalone kit/i.test(subject)) return "standalone";
  }

  if (href === "#pricing" || href.startsWith("#pricing") || href === "#yamale-checkout") {
    const text = (anchor.textContent || "").toLowerCase();
    if (/bundle|\$129|law firm package/i.test(text)) return "bundle";
    if (/\$199|standalone|get the kit/i.test(text)) return "standalone";
  }

  return null;
}

/** USD amount in CTA copy, e.g. "Get the Kit — $199" → 19900. */
export function parseUsdCentsFromCtaText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const m = text.match(/\$\s*(\d+(?:[.,]\d{2})?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** Standalone vs bundle from button/link label (used when pricing cards are not in the DOM path). */
export function detectCheckoutTierFromCtaText(
  text: string | null | undefined
): PackageOfferTier | null {
  if (!text?.trim()) return null;
  const lower = text.toLowerCase();
  if (/\$129|bundle|law firm package \+ /i.test(text)) return "bundle";
  if (/\$199|get the kit|standalone/i.test(lower)) return "standalone";
  const cents = parseUsdCentsFromCtaText(text);
  if (cents === 19900) return "standalone";
  if (cents === 12900) return "bundle";
  return null;
}

/** True when this anchor should scroll the host page to Yamale checkout (not navigate). */
export function shouldInterceptVaultCheckoutAnchor(anchor: {
  getAttribute(name: string): string | null;
  classList?: { contains(name: string): boolean };
  closest?(selector: string): Element | null;
}): boolean {
  const href = (anchor.getAttribute("href") || "").toLowerCase();
  if (href.startsWith("mailto:") && /purchase|kit|bundle|checkout/i.test(href)) return true;
  if (href === "#pricing" || href.startsWith("#pricing") || href === "#yamale-checkout") return true;
  if (href.includes("/pricing")) return true;
  if (anchor.classList?.contains("nav-cta")) return true;
  if (anchor.classList?.contains("btn-primary")) return true;
  if (anchor.closest?.(".cta-section, .pricing-section, .pricing-cards, .cta-buttons")) {
    return true;
  }
  return false;
}

/** In-page section link inside the landing (e.g. #contents for “What's inside”). */
export function isLandingInPageSectionAnchor(anchor: {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}): boolean {
  if (shouldInterceptVaultCheckoutAnchor(anchor)) return false;
  const href = (anchor.getAttribute("href") || "").trim();
  if (href.startsWith("#") && href.length > 1) return true;
  if (/what.?s inside|see what/i.test(anchor.textContent || "")) return true;
  return false;
}

export function landingHashFromAnchor(anchor: {
  getAttribute(name: string): string | null;
  textContent?: string | null;
}): string {
  const href = (anchor.getAttribute("href") || "").trim();
  if (href.startsWith("#") && href.length > 1) return href;
  if (/what.?s inside|see what/i.test(anchor.textContent || "")) return "#contents";
  return "";
}

function wrapLandingBodyMarkup(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `<div class="${LANDING_SHADOW_ROOT_CLASS}"></div>`;
  if (new RegExp(`class=["'][^"']*\\b${LANDING_SHADOW_ROOT_CLASS}\\b`).test(trimmed)) {
    return trimmed;
  }
  return `<div class="${LANDING_SHADOW_ROOT_CLASS}">\n${trimmed}\n</div>`;
}

function adaptStyleBlocksInHtml(html: string): string {
  return html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attrs, inner) => {
    return `<style${attrs}>${adaptLandingCssForShadow(inner)}</style>`;
  });
}

function extractBodyMarkup(doc: string): string {
  const bodyMatch = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch?.[1]) return bodyMatch[1];
  return doc;
}

function extractHeadSnippets(doc: string): string {
  const headMatch = doc.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  if (!headMatch?.[1]) return "";
  const snippets: string[] = [];
  const linkTags = headMatch[1].match(/<link\b[^>]*>/gi);
  if (linkTags) snippets.push(...linkTags);
  const styleBlocks = headMatch[1].match(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
  if (styleBlocks) snippets.push(...styleBlocks);
  return snippets.join("\n");
}

/**
 * HTML fragment for in-page embed (no iframe). Strips scripts, rewrites /pricing links, keeps external CSS/fonts.
 */
export function prepareMarketplaceLandingEmbedHtml(raw: string): string {
  const trimmed = rewriteLandingNavAnchors(raw.trim());
  if (!trimmed) return trimmed;

  let doc = stripViewportFixedInlineStyles(
    trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
  );
  const styleTag = `<style ${LANDING_BASE_STYLE_MARK}>${LANDING_SHADOW_OVERRIDES_CSS}</style>`;

  doc = adaptStyleBlocksInHtml(doc);

  if (/^<!doctype/i.test(doc)) {
    const headBits = adaptStyleBlocksInHtml(extractHeadSnippets(doc));
    const body = wrapLandingBodyMarkup(extractBodyMarkup(doc));
    return `${headBits}\n${styleTag}\n${body}`;
  }

  return `${styleTag}\n${wrapLandingBodyMarkup(doc)}`;
}

export type LandingPageLanguage = "fr" | "en";

const LANDING_LANG_STORAGE_KEY = "yamale-lang";

/** Bilingual landing pages use data-lang blocks + .lang-btn toggles (scripts are stripped in embed mode). */
export function readSavedLandingLanguage(): LandingPageLanguage {
  if (typeof window === "undefined") return "fr";
  try {
    const saved = window.localStorage.getItem(LANDING_LANG_STORAGE_KEY);
    return saved === "en" ? "en" : "fr";
  } catch {
    return "fr";
  }
}

export function saveLandingLanguage(lang: LandingPageLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANDING_LANG_STORAGE_KEY, lang);
  } catch {
    // ignore quota / private mode
  }
}

/** Toggle [data-lang] sections and .lang-btn state inside a shadow root or document. */
export function applyLandingLanguage(root: ParentNode, lang: LandingPageLanguage): void {
  root.querySelectorAll("[data-lang]").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const blockLang = el.getAttribute("data-lang");
    el.classList.toggle("lang-hidden", blockLang !== lang);
  });

  root.querySelectorAll(".lang-btn[data-select-lang]").forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    btn.classList.toggle("active", btn.getAttribute("data-select-lang") === lang);
  });

  const cta = root.querySelector("#nav-cta-text");
  if (cta) cta.textContent = lang === "fr" ? "Obtenir le Kit" : "Get the Kit";

  const price = root.querySelector("#nav-price-text");
  if (price) price.textContent = lang === "fr" ? "199 USD" : "$199";
}

export function landingLanguageFromButton(button: Element): LandingPageLanguage | null {
  const lang = button.getAttribute("data-select-lang");
  return lang === "en" || lang === "fr" ? lang : null;
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
