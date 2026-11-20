// Shared types for the frontend mock data layer (products, activity, KPIs
// -- still mock until Phase 2's Campaign model exists, see
// docs/03-implementation-plan.md). Auth-related shapes (user, workspace)
// live in lib/auth/auth-context.tsx instead, since those are now backed by
// the real API -- see lib/api-client/auth.ts for the wire format.

export type Locale = "en" | "ar";
export type ThemeMode = "light" | "dark";

export type ProductStatus =
  | "draft"
  | "analyzing"
  | "in_progress"
  | "active"
  | "completed"
  | "needs_review"
  | "archived";

export interface Product {
  id: string; // e.g. "PRD-001"
  name: string;
  description: string;
  createdDate: string;
  lastUpdated: string;
  companiesAnalyzed: number;
  emailsSent: number;
  responses: number;
  status: ProductStatus;
  targetMarket: string;
  topIndustries: string[];
  productAgentStatus: AgentRunStatus;
  fitAgentStatus: AgentRunStatus;
  outreachAgentStatus: AgentRunStatus;
}

export type AgentRunStatus = "idle" | "queued" | "running" | "succeeded" | "failed";

export type FitLabel = "high_fit" | "medium_fit" | "low_fit" | "not_fit" | "needs_review";
export type ContactStatus = "verified" | "complete" | "email_needed" | "needs_review";
export type OutreachStatus =
  | "not_started"
  | "draft"
  | "approved"
  | "sent"
  | "delivered"
  | "replied"
  | "bounced";

export interface ScoreFactor {
  factor: "industry_relevance" | "observable_need_signals" | "operational_fit" | "growth_signals";
  weight: number; // percent
  score: number | null; // null = no evidence, never guessed
  evidence: string | null;
  missingReason: string | null;
}

export interface RankedCompany {
  id: string;
  rank: number;
  companyName: string;
  domain: string;
  industry: string;
  city: string;
  fitScore: number | null;
  evidenceCoverage: number | null; // percent
  fitLabel: FitLabel;
  contactStatus: ContactStatus;
  outreachStatus: OutreachStatus;
  scoreFactors: ScoreFactor[];
  whyItFits: string;
  risks: string[];
  missingData: string[];
}

export interface Contact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  verificationStatus: ContactStatus;
  confidence: number | null;
  source: string | null;
  lastCheckedAt: string | null;
}

export interface ActivityEvent {
  id: string;
  type:
    | "analysis_completed"
    | "top_five_selected"
    | "missing_email_flagged"
    | "contact_updated"
    | "draft_generated"
    | "draft_approved"
    | "email_sent"
    | "response_received"
    | "status_changed";
  description: string;
  actor: string; // user name or "Fit Agent" / "Outreach Agent" etc.
  timestamp: string;
}

export interface KpiSummary {
  totalProducts: number;
  companiesAnalyzed: number;
  totalEmailsSent: number;
  responses: number;
  interestedProspects: number;
  conversionRate: number; // percent
  itemsNeedingReview: number;
}

export interface CampaignPerformancePoint {
  date: string;
  emailsSent: number;
  responses: number;
  interested: number;
}

export interface FunnelStage {
  label: string;
  value: number;
}
