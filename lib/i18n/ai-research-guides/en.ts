import type {
  AiResearchGuidesContent,
  SeoLandingPageContentI18n,
  SeoLandingPageUi,
} from "@/lib/i18n/ai-research-guides/types";

const SHARED_FEATURES = [
  {
    title: "Source-backed citations",
    body: "Responses reference library instruments so you can open the underlying statute and verify the answer.",
  },
  {
    title: "54-country legal library",
    body: "Research sits on top of a growing African legal library — searchable by country, topic, and status.",
  },
  {
    title: "Regional frameworks",
    body: "AfCFTA, OHADA, ECOWAS, and other supranational texts are in scope when they appear in retrieved excerpts.",
  },
  {
    title: "Built for practitioners",
    body: "Designed for law firms, trade teams, and students who need fast orientation — with paths to human counsel via the lawyer directory.",
  },
] as const;

const SHARED_FAQS = [
  {
    question: "What is AI legal search in Africa?",
    answer:
      "AI legal search in Africa uses artificial intelligence to help you find and interpret legal rules across African jurisdictions. Yamalé focuses on answers grounded in primary sources in its legal library — statutes and regulations — rather than uncited general web text.",
  },
  {
    question: "How is Yamalé different from ChatGPT for African law?",
    answer:
      "General AI models may invent or misapply rules. Yamalé retrieves excerpts from its African legal library and asks the model to answer using only those texts, with citations to the instruments used. It is a research assistant on your library, not a replacement for professional judgment.",
  },
  {
    question: "Which countries and topics does Yamalé cover?",
    answer:
      "The library targets broad coverage across African countries with depth varying by jurisdiction and topic. OHADA member states, AfCFTA instruments, and major commercial, employment, and trade categories are actively expanded. Check the library or ask a country-specific question to see what is available today.",
  },
  {
    question: "Is Yamalé a substitute for a lawyer?",
    answer:
      "No. Yamalé accelerates research and helps you locate relevant instruments. It does not provide legal advice. For matters that require representation or formal opinions, use the commercial lawyer directory or your own counsel.",
  },
  {
    question: "How do I start using AI legal research on Yamalé?",
    answer:
      "Open AI Research, sign in, and ask a question that names the country and topic — for example, employment law in Mozambique or company registration in Ghana. Plans with AI queries are listed on the pricing page.",
  },
] as const;

export const EN_AI_RESEARCH_GUIDES: AiResearchGuidesContent = {
  eyebrow: "Yamalé AI Legal Research",
  h1: "AI Legal Search in Africa — Answers Grounded in Primary Sources",
  heroSubtitleSignedOut:
    "Sign in to subscribe or purchase a single AI query. Plans include monthly AI research credits grounded in the Yamalé African legal library.",
  whatYouGet: "What you get",
  faqTitle: "Frequently asked questions",
  exploreGuides: "Explore guides",
  exploreGuidesAria: "AI research guides",
  intro: [
    "Yamalé is an AI legal search platform built for Africa. Ask questions in plain language and receive answers drawn from statutes, regulations, and regional instruments in the Yamalé Legal Library — not generic web summaries.",
    "Unlike general-purpose chatbots, Yamalé AI legal research cites the library texts it uses. That matters for lawyers, in-house counsel, compliance teams, and law students who need to know which instrument supports an answer before relying on it in advice, filings, or exams.",
    "Coverage spans national law across African jurisdictions, OHADA business law, AfCFTA trade rules, and other regional frameworks where they appear in the library. When a country's statute is not yet in the corpus, the assistant should say so — not substitute foreign national law.",
  ],
  features: [...SHARED_FEATURES],
  faqs: [...SHARED_FAQS],
  relatedLinks: [
    { href: "/ai-legal-search-africa", label: "AI legal search in Africa" },
    { href: "/ohada-ai-legal-research", label: "OHADA AI legal research" },
    { href: "/afcfta-ai-legal-research", label: "AfCFTA AI legal research" },
    { href: "/african-legal-library-ai", label: "African legal library with AI" },
    { href: "/library", label: "Browse the legal library" },
    { href: "/pricing", label: "View plans" },
  ],
};

export const EN_SEO_PAGE_UI: SeoLandingPageUi = {
  backToPlatform: "Yamalé Legal Platform",
  tryAiResearch: "Try AI Research",
  browseLibrary: "Browse the library",
  whyTeams: "Why teams use Yamalé",
  faqTitle: "Frequently asked questions",
  related: "Related",
  relatedAria: "Related pages",
  viewPricing: "View pricing",
  contactUs: "Contact us",
};

export const EN_SEO_LANDING_PAGES: Record<string, SeoLandingPageContentI18n> = {
  aiLegalSearchAfrica: {
    metaTitle: "AI Legal Search in Africa — Source-Backed Research | Yamalé",
    metaDescription:
      "AI legal search in Africa grounded in statutes and regulations. Yamalé cites African primary sources from its legal library — for lawyers, teams, and students.",
    keywords: [
      "AI legal search in Africa",
      "AI legal search Africa",
      "African legal AI",
      "legal research Africa AI",
    ],
    eyebrow: "AI legal search · Africa",
    h1: "AI Legal Search in Africa — Grounded in Statutes, Not Guesswork",
    intro: [
      "Searching African law should not mean scrolling endless PDFs or trusting a chatbot with no sources. Yamalé combines AI legal search with a dedicated African legal library so answers can point to the instruments they rely on.",
      "Whether you work on cross-border trade, local compliance, or academic study, you can ask questions in natural language and review cited statutes and regulations. The platform is African-built and designed for the way continental and national rules actually layer — domestic law, regional economic communities, OHADA, and AfCFTA.",
      "Start with a specific country and topic for the best results. Yamalé is expanding corpus coverage continuously; when a text is not in the library, the research assistant should acknowledge the gap instead of substituting another country's law.",
    ],
    features: [...SHARED_FEATURES],
    faqs: [...SHARED_FAQS],
    relatedLinks: [
      { href: "/ai-research", label: "Open AI Research" },
      { href: "/library", label: "African legal library" },
      { href: "/ohada-ai-legal-research", label: "OHADA AI research" },
      { href: "/afcfta-ai-legal-research", label: "AfCFTA AI research" },
    ],
  },
  ohada: {
    metaTitle: "OHADA AI Legal Research — Uniform Acts & Business Law | Yamalé",
    metaDescription:
      "Research OHADA uniform acts and business law with AI grounded in library texts. Company law, commercial law, and OHADA instruments with citations.",
    keywords: ["OHADA AI legal research", "OHADA law AI", "OHADA uniform acts search", "OHADA business law"],
    eyebrow: "OHADA · AI legal research",
    h1: "OHADA AI Legal Research on Primary Sources",
    intro: [
      "OHADA harmonises business law across member states. Yamalé helps you search and interpret OHADA uniform acts and related instruments using AI that is constrained to library excerpts — so you can trace answers back to the act itself.",
      "Use OHADA AI legal research for company formation, commercial contracts, arbitration, and cross-border operations within the OHADA zone. Combine AI queries with direct library browsing when you need the full text of an act or article.",
      "For national rules that sit beside OHADA texts, name the member state in your question. Regional instruments and domestic implementing law are handled differently; Yamalé prioritises the instruments actually retrieved for your query.",
    ],
    features: [
      {
        title: "Uniform acts in the library",
        body: "Search OHADA company law, commercial law, and related texts alongside national implementing legislation where available.",
      },
      {
        title: "Cited answers",
        body: "AI responses reference library documents so you can verify articles and definitions in context.",
      },
      {
        title: "Practitioner workflow",
        body: "Move from AI summary to full instrument text in the library without leaving the platform.",
      },
      {
        title: "Francophone & anglophone use",
        body: "Ask in the language you work in; focus on the legal issue and jurisdiction for best retrieval.",
      },
    ],
    faqs: [
      {
        question: "Can Yamalé answer OHADA company law questions?",
        answer:
          "Yes, when the relevant OHADA uniform acts and excerpts are in the library. Ask a specific question — for example directors' duties under OHADA company law — and review the cited instruments in the response.",
      },
      {
        question: "Does OHADA AI research replace reading the uniform act?",
        answer:
          "No. AI research helps you locate and orient within OHADA texts faster. Always read the cited provisions and confirm updates or national variations before advising clients.",
      },
      {
        question: "Which OHADA countries are supported?",
        answer:
          "OHADA member states share uniform acts; national implementing measures may differ. Name the country in your query when you need domestic context alongside OHADA rules.",
      },
      {
        question: "How do I try OHADA AI legal research?",
        answer:
          "Sign in to AI Research on Yamalé and ask an OHADA-focused question, or browse OHADA instruments in the library first.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Open AI Research" },
      { href: "/library", label: "Browse OHADA texts" },
      { href: "/ai-legal-search-africa", label: "AI legal search in Africa" },
    ],
  },
  afcfta: {
    metaTitle: "AfCFTA AI Legal Research — Trade Rules & Compliance | Yamalé",
    metaDescription:
      "AI legal research for AfCFTA rules of origin, tariff schedules, and trade compliance — grounded in Yamalé library sources with citations.",
    keywords: [
      "AfCFTA AI legal research",
      "AfCFTA compliance AI",
      "AfCFTA rules of origin",
      "African trade law AI",
    ],
    eyebrow: "AfCFTA · AI legal research",
    h1: "AfCFTA AI Legal Research for Trade & Compliance Teams",
    intro: [
      "The African Continental Free Trade Area changes how businesses think about rules of origin, tariffs, and market access. Yamalé supports AfCFTA AI legal research on top of trade instruments and related library texts.",
      "Compliance officers and trade lawyers can ask targeted questions — certificates of origin, product eligibility, phase-down schedules — and receive answers tied to retrieved AfCFTA and related sources. Use dedicated AfCFTA tools on the platform for structured compliance workflows alongside AI research.",
      "Pair AI queries with the compliance check and tariff schedule tools when you need interactive workflows, not only narrative answers.",
    ],
    features: [
      {
        title: "Trade-focused retrieval",
        body: "Questions about AfCFTA instruments pull from library texts rather than generic training data.",
      },
      {
        title: "Compliance tooling",
        body: "Use AfCFTA compliance check and journey tools together with AI research for end-to-end workflows.",
      },
      {
        title: "Cross-border context",
        body: "Frame questions with product, corridor, and member states for more precise retrieval.",
      },
      {
        title: "Citable outputs",
        body: "Review which instruments the model used before relying on an answer in filings or client advice.",
      },
    ],
    faqs: [
      {
        question: "Can Yamalé help with AfCFTA rules of origin?",
        answer:
          "Yamalé can help orient you within AfCFTA rules when the relevant texts are in the library. Ask a specific product and corridor question and verify citations against the official instruments.",
      },
      {
        question: "Is there a separate AfCFTA compliance tool?",
        answer:
          "Yes. Yamalé offers AfCFTA compliance check and related tools in addition to AI legal research. Use both when you need structured checks and free-form Q&A.",
      },
      {
        question: "Who is AfCFTA AI research for?",
        answer:
          "Exporters, importers, in-house trade teams, customs advisers, and lawyers advising on African market access.",
      },
    ],
    relatedLinks: [
      { href: "/ai-research", label: "Open AI Research" },
      { href: "/afcfta/compliance-check", label: "AfCFTA compliance check" },
      { href: "/afcfta/tariff-schedule", label: "Tariff schedule tool" },
      { href: "/ai-legal-search-africa", label: "AI legal search in Africa" },
    ],
  },
  africanLegalLibraryAi: {
    metaTitle: "African Legal Library with AI — Search Statutes by Country | Yamalé",
    metaDescription:
      "Browse and search African statutes across 54 countries, then run AI legal research on the same primary sources. One platform for library search and cited AI answers.",
    keywords: [
      "African legal library AI",
      "African law database",
      "search African statutes",
      "legal library Africa",
    ],
    eyebrow: "Legal library · AI research",
    h1: "African Legal Library with AI — Search, Read, and Ask",
    intro: [
      "Yamalé pairs a searchable African legal library with AI legal research on the same corpus. Browse statutes by country and category, open full texts, then ask follow-up questions in AI Research with citations back to the instruments you are working on.",
      "For law students, the workflow supports exam prep and coursework: find the act, read the articles, then test your understanding with cited Q&A. For firms and in-house teams, it reduces time spent hunting PDFs across jurisdictions.",
      "The library is the source of truth. AI is a layer on top — useful for orientation and issue-spotting, not a substitute for reading primary sources or professional advice.",
    ],
    features: [
      {
        title: "Unified corpus",
        body: "AI research and library browsing draw from the same growing collection of African legal texts.",
      },
      {
        title: "Filter by jurisdiction",
        body: "Narrow by country, category, and status before you research or ask AI questions.",
      },
      {
        title: "From citation to full text",
        body: "Open cited laws directly from AI research source cards when you need the complete instrument.",
      },
      {
        title: "Vault & counsel",
        body: "Combine library and AI work with templates in The Yamalé Vault and the lawyer directory.",
      },
    ],
    faqs: [
      {
        question: "How many countries does the Yamalé legal library cover?",
        answer:
          "The platform is built for broad African coverage across 54 countries, with depth varying by jurisdiction and topic. Use library filters to see what is available for a given country today.",
      },
      {
        question: "Can I use the library without AI?",
        answer:
          "Yes. Library browsing is available on free and paid plans. AI research requires a plan that includes AI queries.",
      },
      {
        question: "Does AI search the whole internet?",
        answer:
          "No. Yamalé AI legal research is designed to answer from library excerpts (plus optional limited web supplements for orientation), not the open web as binding law.",
      },
    ],
    relatedLinks: [
      { href: "/library", label: "Open the legal library" },
      { href: "/ai-research", label: "AI legal research" },
      { href: "/ai-legal-search-africa", label: "AI legal search in Africa" },
      { href: "/pricing", label: "Plans & pricing" },
    ],
  },
};
