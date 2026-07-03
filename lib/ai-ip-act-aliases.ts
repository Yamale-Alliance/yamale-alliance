/**
 * Domestic IP statute aliases — many countries use a unified Industrial Property Act
 * rather than separate Patents / Trademarks Acts.
 */

/** User asks for a domestic IP statute (not an international treaty). */
export function isDomesticIpStatuteQuery(query: string): boolean {
  const q = query.toLowerCase();
  const asksDomestic =
    /\b(trademarks?\s+act|patents?\s+act|industrial\s+property\s+act|trade\s+marks?\s+act|intellectual\s+property\s+act)\b/i.test(
      q
    ) ||
    (/\b(trademark|patent|industrial\s+property)\b/i.test(q) && /\bact\b/i.test(q));
  const asksTreatyOnly =
    /\b(convention|protocol|treaty|wipo|paris|berne|pct|harare|aripo|madrid)\b/i.test(q);
  return asksDomestic && !asksTreatyOnly;
}

export function isNationalTrademarksActTitle(title: string): boolean {
  return /\btrademarks?\s+act\b/i.test(title) || /\btrade\s+marks?\s+act\b/i.test(title);
}

/** Title phrases for ilike when users say "trademark act" but corpus uses "Trade Marks Act". */
export function trademarkActTitleSearchPhrases(): string[] {
  return ["trade marks act", "trademarks act", "trade mark act", "trademark act"];
}

export function hintLooksLikeTrademarksAct(hint: string): boolean {
  const h = hint.toLowerCase();
  return /\btrademarks?\s+act\b/i.test(h) || /\btrade\s+marks?\s+act\b/i.test(h);
}

/** International IP treaties — demote when user asks for a national Trademarks / Patents Act. */
export function isInternationalIpTreatyTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    /\b(paris\s+convention|berne\s+convention|trips|wipo\s+convention|madrid\s+protocol|pct|patent\s+cooperation|harare\s+protocol|bangui\s+agreement|oapi|aripo)\b/i.test(
      t
    ) || (/\b(convention|protocol|treaty)\b/i.test(t) && /\b(intellectual|industrial|property|mark|patent|copyright)\b/i.test(t))
  );
}

export function isNationalIndustrialPropertyActTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (/\b(industrial\s+property|intellectual\s+property)\b/i.test(t) && /\bact\b/i.test(t)) {
    return !/\b(convention|protocol|treaty|regulation)\b/i.test(t);
  }
  if (/\bpatents?\s+act\b/i.test(t) && !/\b(cooperation|convention|protocol|treaty)\b/i.test(t)) {
    return true;
  }
  return false;
}

/** National domestic IP code (trademarks, patents, or unified industrial property). */
export function isDomesticIpActTitle(title: string): boolean {
  return isNationalTrademarksActTitle(title) || isNationalIndustrialPropertyActTitle(title);
}

export function isTrademarkInstrumentTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (/\btrademarks?\b/.test(t)) return true;
  if (/\btrade\s+marks?\b/.test(t)) return true;
  if (/\bmadrid\b/.test(t) && /\b(mark|protocol|agreement|registration)\b/.test(t)) return true;
  if (isNationalIndustrialPropertyActTitle(title)) return true;
  return false;
}

/** Query tokens to add when the user names a Patents / Trademarks Act but the corpus uses Industrial Property Act. */
export function expandDomesticIpQueryTerms(query: string): string[] {
  if (!isDomesticIpStatuteQuery(query)) return [];
  return [
    "industrial property act",
    "industrial property",
    "intellectual property act",
    "patents act",
    "trademarks act",
    "trade marks act",
  ];
}
