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
  if (/\bmadrid\b/.test(t) && /\b(mark|protocol|agreement|registration)\b/.test(t)) return true;
  if (isNationalIndustrialPropertyActTitle(title)) return true;
  return false;
}
