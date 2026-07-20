export type AdvisoryDocumentStatus = "not_started" | "in_progress" | "complete";

export type AdvisoryDocumentKind =
  | "template"
  | "policy"
  | "framework"
  | "checklist"
  | "tool"
  | "video";

export type AdvisoryDocumentSection = {
  title: string;
  body: string;
};

export type AdvisoryDocument = {
  id: string;
  code: string;
  title: string;
  description: string;
  kind: AdvisoryDocumentKind;
  categoryId: string;
  phaseId: string;
  estimatedMinutes?: number;
  lastUpdated?: string;
  sections?: AdvisoryDocumentSection[];
  toolPath?: string;
  /** Path inside the course package ZIP (for in-workspace open/preview). */
  sourcePath?: string;
};

export type AdvisoryCategory = {
  id: string;
  code: string;
  name: string;
  documents: AdvisoryDocument[];
};

export type AdvisoryPhase = {
  id: string;
  slug: string;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  estimatedWeeks?: number;
  categories: AdvisoryCategory[];
};

export type AdvisoryMilestone = {
  id: string;
  title: string;
  dueLabel: string;
  completed?: boolean;
  completedLabel?: string;
};

export type AdvisoryProgressSnapshot = {
  documentStatus: Record<string, AdvisoryDocumentStatus>;
  sectionProgress?: Record<string, number>;
  documentNotes?: Record<string, string>;
  firmName?: string;
  firmLocation?: string;
  subscriptionLabel?: string;
};
