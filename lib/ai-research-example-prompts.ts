export const EXAMPLE_QUESTIONS_POOL = [
  "What are the requirements for company registration in Ghana?",
  "What is the minimum wage under Kenyan employment law?",
  "What documents are needed for an AfCFTA certificate of origin?",
  "What are the rules of origin for manufactured goods under AfCFTA?",
  "How does VAT work for cross-border services in Nigeria?",
  "What are the key labour protections for employees in South Africa?",
  "What permits are required to export agricultural products under AfCFTA?",
  "How do I register a trademark in Kenya?",
  "What customs documents are needed to import machinery into Rwanda?",
  "How are AfCFTA tariff phase-down schedules applied for sensitive products?",
  "What are the main corporate tax obligations for a company in Senegal?",
  "How do rules of origin differ between AfCFTA and ECOWAS?",
  "Summarize the main licensing and environmental obligations for mining projects in Ethiopia.",
  "What are OHADA uniform act requirements for forming an SARL?",
  "How is personal data protected under Nigerian data protection law?",
  "What foreign investment restrictions apply to telecoms in Egypt?",
  "What notice periods apply for employment termination in Morocco?",
  "How does double taxation relief work for cross-border dividends in Mauritius?",
  "What environmental impact assessments are required for oil and gas projects in Angola?",
  "What are the bankruptcy procedures under OHADA uniform insolvency law?",
] as const;

export function pickRandomExampleQuestions(count: number): string[] {
  const pool = [...EXAMPLE_QUESTIONS_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
