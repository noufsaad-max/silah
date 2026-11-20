import type {
  ActivityEvent,
  CampaignPerformancePoint,
  FunnelStage,
  KpiSummary,
  Product,
} from "@/types";

// The demo account's real identity (name, workspace, job title) now comes
// from the backend via /api/v1/auth/me -- see lib/auth/auth-context.tsx.
// This only stays here because the login screen's hint text
// (components/marketing/LoginForm.tsx) references the credential pair, and
// scripts/init_sqlite_db.py seeds an account matching it.
export const DEMO_CREDENTIALS = {
  email: "demo@silah.sa",
  password: "Demo123!",
};

export const mockProducts: Product[] = [
  {
    id: "PRD-001",
    name: "Silah Connect",
    description: "Core outbound prospecting workflow for B2B SaaS teams.",
    createdDate: "2026-04-01",
    lastUpdated: "2026-04-20",
    companiesAnalyzed: 120,
    emailsSent: 120,
    responses: 34,
    status: "active",
    targetMarket: "Saudi Arabia, UAE",
    topIndustries: ["Logistics", "Fintech", "Retail Tech"],
    productAgentStatus: "succeeded",
    fitAgentStatus: "succeeded",
    outreachAgentStatus: "running",
  },
  {
    id: "PRD-002",
    name: "Silah Reach",
    description: "Expansion campaign targeting mid-market logistics firms.",
    createdDate: "2026-03-20",
    lastUpdated: "2026-04-18",
    companiesAnalyzed: 80,
    emailsSent: 80,
    responses: 12,
    status: "in_progress",
    targetMarket: "Saudi Arabia",
    topIndustries: ["Logistics", "Manufacturing"],
    productAgentStatus: "succeeded",
    fitAgentStatus: "running",
    outreachAgentStatus: "idle",
  },
  {
    id: "PRD-003",
    name: "Silah Insights",
    description: "Analytics add-on pitched to existing customers' partners.",
    createdDate: "2026-02-10",
    lastUpdated: "2026-04-10",
    companiesAnalyzed: 60,
    emailsSent: 60,
    responses: 28,
    status: "completed",
    targetMarket: "Saudi Arabia",
    topIndustries: ["Fintech"],
    productAgentStatus: "succeeded",
    fitAgentStatus: "succeeded",
    outreachAgentStatus: "succeeded",
  },
  {
    id: "PRD-004",
    name: "Silah Market",
    description: "Marketplace vertical -- data import in progress.",
    createdDate: "2026-01-05",
    lastUpdated: "2026-04-05",
    companiesAnalyzed: 45,
    emailsSent: 45,
    responses: 8,
    status: "needs_review",
    targetMarket: "Saudi Arabia",
    topIndustries: ["Retail Tech", "Fintech"],
    productAgentStatus: "succeeded",
    fitAgentStatus: "failed",
    outreachAgentStatus: "idle",
  },
];

export const mockKpis: KpiSummary = {
  totalProducts: mockProducts.length,
  companiesAnalyzed: mockProducts.reduce((sum, p) => sum + p.companiesAnalyzed, 0),
  totalEmailsSent: mockProducts.reduce((sum, p) => sum + p.emailsSent, 0),
  responses: mockProducts.reduce((sum, p) => sum + p.responses, 0),
  interestedProspects: 21,
  conversionRate: 25,
  itemsNeedingReview: 6,
};

export const mockCampaignPerformance: CampaignPerformancePoint[] = [
  { date: "Feb 01", emailsSent: 40, responses: 6, interested: 3 },
  { date: "Feb 15", emailsSent: 65, responses: 10, interested: 5 },
  { date: "Mar 01", emailsSent: 90, responses: 18, interested: 9 },
  { date: "Mar 15", emailsSent: 150, responses: 26, interested: 14 },
  { date: "Apr 01", emailsSent: 220, responses: 40, interested: 19 },
  { date: "Apr 15", emailsSent: 305, responses: 60, interested: 25 },
];

export const mockFunnel: FunnelStage[] = [
  { label: "Imported Companies", value: 300 },
  { label: "Evaluated Companies", value: 265 },
  { label: "High-Fit Companies", value: 84 },
  { label: "Top 5 Prospects", value: 20 },
  { label: "Contacted", value: 17 },
  { label: "Replied", value: 6 },
];

export const mockActivity: ActivityEvent[] = [
  {
    id: "act_1",
    type: "email_sent",
    description: "Email sent to tech@company.com",
    actor: "Outreach Agent",
    timestamp: "2026-04-20T10:30:00Z",
  },
  {
    id: "act_2",
    type: "response_received",
    description: "New response from ali@partner.com",
    actor: "Contact",
    timestamp: "2026-04-19T02:15:00Z",
  },
  {
    id: "act_3",
    type: "status_changed",
    description: "Status updated to In Progress",
    actor: "Ahmed Al-Qahtani",
    timestamp: "2026-04-18T11:00:00Z",
  },
  {
    id: "act_4",
    type: "top_five_selected",
    description: "Top five prospects selected for Silah Connect",
    actor: "Fit Agent",
    timestamp: "2026-04-17T09:05:00Z",
  },
  {
    id: "act_5",
    type: "missing_email_flagged",
    description: "Missing email flagged for Nour Trading Co.",
    actor: "Fit Agent",
    timestamp: "2026-04-16T14:40:00Z",
  },
];
