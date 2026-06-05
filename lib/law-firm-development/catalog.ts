import type {
  AdvisoryCategory,
  AdvisoryDocument,
  AdvisoryPhase,
} from "@/lib/law-firm-development/types";

function doc(
  partial: AdvisoryDocument & { categoryId: string; phaseId: string }
): AdvisoryDocument {
  return partial;
}

const PHASE_1_ID = "phase-1";

const phase1Categories: AdvisoryCategory[] = [
  {
    id: "sp",
    code: "SP",
    name: "Strategic Planning",
    documents: [
      doc({
        id: "sp-01",
        code: "SP-01",
        categoryId: "sp",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Strategic Planning Workbook",
        description: "Annual planning, SWOT, goal-setting, quarterly review tools",
        estimatedMinutes: 45,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "sp-02",
        code: "SP-02",
        categoryId: "sp",
        phaseId: PHASE_1_ID,
        kind: "framework",
        title: "Governance Framework",
        description: "Board structure, partner agreements, decision-making authority",
        estimatedMinutes: 35,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "sp-03",
        code: "SP-03",
        categoryId: "sp",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Partnership & Ownership Documents",
        description: "Equity structures, profit-sharing, buy-sell provisions",
        estimatedMinutes: 40,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "sp-04",
        code: "SP-04",
        categoryId: "sp",
        phaseId: PHASE_1_ID,
        kind: "framework",
        title: "Financial Systems Setup Guide",
        description: "Chart of accounts, accounting system selection, reporting calendar",
        estimatedMinutes: 30,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "sp-05",
        code: "SP-05",
        categoryId: "sp",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Billing & Collections System",
        description: "Billing policy, invoice templates, collections escalation, WIP management",
        estimatedMinutes: 35,
        lastUpdated: "May 2026",
      }),
    ],
  },
  {
    id: "gov",
    code: "GOV",
    name: "Governance",
    documents: [
      doc({
        id: "gov-01",
        code: "GOV-01",
        categoryId: "gov",
        phaseId: PHASE_1_ID,
        kind: "framework",
        title: "Partner Decision Matrix",
        description: "Authority levels, voting thresholds, and escalation paths",
        estimatedMinutes: 25,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "gov-02",
        code: "GOV-02",
        categoryId: "gov",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Management Committee Charter",
        description: "Committee composition, meeting cadence, and reporting lines",
        estimatedMinutes: 20,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "gov-03",
        code: "GOV-03",
        categoryId: "gov",
        phaseId: PHASE_1_ID,
        kind: "checklist",
        title: "Annual Governance Review",
        description: "Year-end governance health check for African law firms",
        estimatedMinutes: 15,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "gov-04",
        code: "GOV-04",
        categoryId: "gov",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Conflicts & Ethics Policy",
        description: "Client conflict screening and professional conduct standards",
        estimatedMinutes: 30,
        lastUpdated: "May 2026",
      }),
    ],
  },
  {
    id: "fsg",
    code: "FSG",
    name: "Financial Systems",
    documents: [
      doc({
        id: "fsg-01",
        code: "FSG-01",
        categoryId: "fsg",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Chart of Accounts Setup",
        description: "Law firm account structure for income, expenses, client funds",
        estimatedMinutes: 25,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fsg-02",
        code: "FSG-02",
        categoryId: "fsg",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Financial Reporting Templates",
        description: "Monthly management accounts, partner dashboard, annual review",
        estimatedMinutes: 18,
        lastUpdated: "May 2026",
        sections: [
          {
            title: "Overview",
            body: "This document provides the financial reporting templates a well-run African law firm needs to monitor performance, support partner decision-making, and meet jurisdictional reporting obligations. The templates are designed for firms operating in common law and OHADA jurisdictions and accommodate multi-currency operations where relevant.",
          },
          {
            title: "Monthly Management Accounts",
            body: "The monthly pack covers profit and loss against budget, balance sheet, cash position, and key performance indicators. The pack should be available to partners by the tenth working day of the following month. Partners should review the pack before the monthly partners' meeting so the meeting can focus on decisions rather than walk-throughs.",
          },
          {
            title: "Partner Reporting Dashboard",
            body: "The partner dashboard provides each partner with a confidential view of their own performance against firm targets. The dashboard covers individual originations, working attorney hours, realisation rates, and collections performance.",
          },
          {
            title: "Annual Financial Review",
            body: "The annual financial review framework supports the partners' year-end discussion of firm performance, equity allocation, and the following year's budget.",
          },
        ],
      }),
      doc({
        id: "fsg-03",
        code: "FSG-03",
        categoryId: "fsg",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Budget Template",
        description: "Annual operating budget, capital expenditure, variance analysis",
        estimatedMinutes: 30,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fsg-04",
        code: "FSG-04",
        categoryId: "fsg",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Cash Flow Management",
        description: "13-week forecast, liquidity monitoring, working capital management",
        estimatedMinutes: 28,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fsg-05",
        code: "FSG-05",
        categoryId: "fsg",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Client Trust Account Management",
        description: "Trust account protocols, reconciliation, regulatory compliance",
        estimatedMinutes: 35,
        lastUpdated: "May 2026",
      }),
    ],
  },
  {
    id: "bnc",
    code: "BNC",
    name: "Billing & Collections",
    documents: [
      doc({
        id: "bnc-01",
        code: "BNC-01",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Time Recording Policy",
        description: "Daily time recording standards, minimum entry requirements",
        estimatedMinutes: 20,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "bnc-02",
        code: "BNC-02",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Fee Agreement Templates",
        description: "Hourly, fixed fee, and retainer engagement letter templates",
        estimatedMinutes: 40,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "bnc-03",
        code: "BNC-03",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Invoice Templates",
        description: "Professional invoice formats, disbursement billing, multi-currency",
        estimatedMinutes: 25,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "bnc-04",
        code: "BNC-04",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Collections Policy",
        description: "Payment terms, escalation framework, late payment interest",
        estimatedMinutes: 22,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "bnc-05",
        code: "BNC-05",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "WIP and Billing Dashboard",
        description: "Work-in-progress monitoring, billing lock-up, collection rate tracking",
        estimatedMinutes: 30,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "bnc-06",
        code: "BNC-06",
        categoryId: "bnc",
        phaseId: PHASE_1_ID,
        kind: "tool",
        title: "Billing Rate Calculator",
        description: "Fillable tool for calculating target hourly rates by role",
        toolPath: "billing-rate-calculator",
      }),
    ],
  },
  {
    id: "fct",
    code: "FCT",
    name: "Financial Controls",
    documents: [
      doc({
        id: "fct-01",
        code: "FCT-01",
        categoryId: "fct",
        phaseId: PHASE_1_ID,
        kind: "checklist",
        title: "Internal Controls Checklist",
        description: "Segregation of duties, approvals, and audit trail requirements",
        estimatedMinutes: 20,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fct-02",
        code: "FCT-02",
        categoryId: "fct",
        phaseId: PHASE_1_ID,
        kind: "policy",
        title: "Expense & Disbursement Policy",
        description: "Partner and staff expense rules, client disbursement handling",
        estimatedMinutes: 25,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fct-03",
        code: "FCT-03",
        categoryId: "fct",
        phaseId: PHASE_1_ID,
        kind: "framework",
        title: "Fraud Prevention Framework",
        description: "Red flags, whistleblowing, and incident response for law firms",
        estimatedMinutes: 30,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fct-04",
        code: "FCT-04",
        categoryId: "fct",
        phaseId: PHASE_1_ID,
        kind: "checklist",
        title: "Quarterly Controls Review",
        description: "Partner sign-off checklist for financial controls",
        estimatedMinutes: 15,
        lastUpdated: "May 2026",
      }),
      doc({
        id: "fct-05",
        code: "FCT-05",
        categoryId: "fct",
        phaseId: PHASE_1_ID,
        kind: "template",
        title: "Audit Preparation Pack",
        description: "Documentation index and readiness worksheet for external audit",
        estimatedMinutes: 35,
        lastUpdated: "May 2026",
      }),
    ],
  },
];

/** Programme phases — Phase 1 is fully navigable; others are listed for tracker/dashboard. */
export const ADVISORY_PHASES: AdvisoryPhase[] = [
  {
    id: PHASE_1_ID,
    slug: "phase-1",
    number: 1,
    title: "Foundational Business Infrastructure",
    subtitle: "Strategic planning, governance, financial systems, billing, and financial controls",
    description:
      "The financial, governance, and strategic foundations every well-run African law firm needs. Complete this phase first.",
    estimatedWeeks: 6,
    categories: phase1Categories,
  },
  {
    id: "phase-2",
    slug: "phase-2",
    number: 2,
    title: "Human Resources & Talent Management",
    subtitle: "HR manual, position descriptions, recruitment, performance, compensation",
    description: "Build the people systems that support growth and partner accountability.",
    categories: [],
  },
  {
    id: "phase-3",
    slug: "phase-3",
    number: 3,
    title: "Operations & Technology",
    subtitle: "Technology roadmap, data management, cloud migration, software setup",
    description: "Operational infrastructure and technology adoption for modern practice.",
    categories: [],
  },
  {
    id: "phase-4",
    slug: "phase-4",
    number: 4,
    title: "Business Development & Client Relations",
    subtitle: "Marketing strategy, digital toolkit, BD tools, branding and communications",
    description: "Client acquisition, retention, and firm positioning across African markets.",
    categories: [],
  },
  {
    id: "phase-6",
    slug: "phase-6",
    number: 6,
    title: "Practice Area Development",
    subtitle: "Practice group leadership and matter economics",
    description: "Specialisation, pricing, and practice-group management.",
    categories: [],
  },
  {
    id: "phase-7",
    slug: "phase-7",
    number: 7,
    title: "Growth & Expansion",
    subtitle: "Multi-office management and strategic partnerships",
    description: "Scaling beyond a single office and building strategic alliances.",
    categories: [],
  },
  {
    id: "phase-8",
    slug: "phase-8",
    number: 8,
    title: "Specialized African Context",
    subtitle: "Language & cultural considerations; challenges & solutions",
    description: "Jurisdiction-specific guidance for operating across African legal systems.",
    categories: [],
  },
];

/** Aggregate document counts for phases not yet loaded in the catalog (matches Tier 1 mock totals). */
export const ADVISORY_PHASE_DOC_TOTALS: Record<string, number> = {
  "phase-1": 20,
  "phase-2": 31,
  "phase-3": 23,
  "phase-4": 23,
  "phase-6": 8,
  "phase-7": 9,
  "phase-8": 9,
};

export const ADVISORY_TOTAL_DOCUMENTS = Object.values(ADVISORY_PHASE_DOC_TOTALS).reduce(
  (sum, n) => sum + n,
  0
);

export const ADVISORY_LIBRARY_FILTER_LABELS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "template", label: "Templates" },
  { id: "policy", label: "Policies" },
  { id: "framework", label: "Frameworks" },
  { id: "checklist", label: "Checklists" },
  { id: "tool", label: "Interactive tools" },
];

export function getAdvisoryPhase(slug: string): AdvisoryPhase | undefined {
  return ADVISORY_PHASES.find((p) => p.slug === slug);
}

export function listAdvisoryDocuments(): AdvisoryDocument[] {
  const out: AdvisoryDocument[] = [];
  for (const phase of ADVISORY_PHASES) {
    for (const cat of phase.categories) {
      out.push(...cat.documents);
    }
  }
  return out;
}

export function getAdvisoryDocument(docId: string): AdvisoryDocument | undefined {
  return listAdvisoryDocuments().find((d) => d.id === docId);
}

export function getAdvisoryCategory(categoryId: string): AdvisoryCategory | undefined {
  for (const phase of ADVISORY_PHASES) {
    const cat = phase.categories.find((c) => c.id === categoryId);
    if (cat) return cat;
  }
  return undefined;
}

export function phaseDocumentTotal(phaseId: string): number {
  const phase = ADVISORY_PHASES.find((p) => p.id === phaseId);
  if (!phase) return ADVISORY_PHASE_DOC_TOTALS[phaseId] ?? 0;
  const inCatalog = phase.categories.reduce((n, c) => n + c.documents.length, 0);
  return inCatalog > 0 ? inCatalog : (ADVISORY_PHASE_DOC_TOTALS[phaseId] ?? 0);
}
