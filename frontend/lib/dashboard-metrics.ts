// Pure functions that turn real pipeline data (products/prospects/outreach)
// into the numbers the dashboard shows. No mock data and no fabricated
// event history: the "recent activity" list below is each outreach record's
// *current* status (we don't store a status-transition log), not a replay
// of everything that happened to it -- see computeRecentActivity.
import type { OutreachStatus, OutreachWithContext, Product, ProspectWithContext } from "@/lib/api-client/pipeline";

export interface DashboardKpis {
  totalProducts: number;
  companiesAnalyzed: number;
  totalEmailsSent: number;
  responses: number;
  interestedProspects: number;
  conversionRate: number;
  itemsNeedingReview: number;
}

// An outreach counts as "sent" once it has actually gone out (or failed
// trying) -- draft/approved haven't reached the wire yet.
const SENT_STATUSES = new Set<OutreachStatus>(["sent", "failed", "replied", "not_interested", "meeting_requested"]);
// A "response" is any status that only gets set after the recipient did
// something (reply, decline, or booking a meeting).
const REPLIED_STATUSES = new Set<OutreachStatus>(["replied", "meeting_requested", "not_interested"]);

export function computeKpis(
  products: Product[],
  prospects: ProspectWithContext[],
  outreach: OutreachWithContext[]
): DashboardKpis {
  const totalEmailsSent = outreach.filter((o) => SENT_STATUSES.has(o.status)).length;
  const responses = outreach.filter((o) => REPLIED_STATUSES.has(o.status)).length;
  const interestedProspects = outreach.filter((o) => o.status === "meeting_requested" || o.status === "replied").length;

  return {
    totalProducts: products.length,
    companiesAnalyzed: prospects.length,
    totalEmailsSent,
    responses,
    interestedProspects,
    conversionRate: totalEmailsSent > 0 ? Math.round((responses / totalEmailsSent) * 100) : 0,
    itemsNeedingReview: outreach.filter((o) => o.status === "draft").length,
  };
}

export interface FunnelStageData {
  key: "drafted" | "approved" | "sent" | "replied";
  value: number;
}

export function computeFunnel(outreach: OutreachWithContext[]): FunnelStageData[] {
  return [
    { key: "drafted", value: outreach.length },
    { key: "approved", value: outreach.filter((o) => o.status !== "draft" && o.status !== "not_sent").length },
    { key: "sent", value: outreach.filter((o) => SENT_STATUSES.has(o.status)).length },
    { key: "replied", value: outreach.filter((o) => REPLIED_STATUSES.has(o.status)).length },
  ];
}

export interface DailyPoint {
  date: string;
  emailsSent: number;
  responses: number;
  interested: number;
}

// Buckets outreach rows by the day they were actually sent (falling back to
// created_at for rows with no sent_at, e.g. failed sends) over a trailing
// window. Rows with neither timestamp, or outside the window, are dropped
// rather than guessed at.
export function computeDailySeries(outreach: OutreachWithContext[], days = 14): DailyPoint[] {
  const buckets = new Map<string, DailyPoint>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, emailsSent: 0, responses: 0, interested: 0 });
  }

  for (const o of outreach) {
    const ts = o.sent_at ?? o.created_at;
    if (!ts) continue;
    const day = ts.slice(0, 10);
    const bucket = buckets.get(day);
    if (!bucket) continue;
    if (SENT_STATUSES.has(o.status)) bucket.emailsSent += 1;
    if (REPLIED_STATUSES.has(o.status)) bucket.responses += 1;
    if (o.status === "meeting_requested") bucket.interested += 1;
  }

  return Array.from(buckets.values());
}

export interface RecentActivityItem {
  id: string;
  status: OutreachStatus;
  companyName: string;
  timestamp: string | null;
}

// Latest N outreach rows that have left "not_sent", newest first. Each item
// reflects that row's current status only -- if a draft was later sent, only
// the "sent" event shows here, not the earlier "draft" one.
export function computeRecentActivity(outreach: OutreachWithContext[], limit = 8): RecentActivityItem[] {
  return [...outreach]
    .filter((o) => o.status !== "not_sent")
    .sort((a, b) => {
      const at = new Date(a.sent_at ?? a.created_at ?? 0).getTime();
      const bt = new Date(b.sent_at ?? b.created_at ?? 0).getTime();
      return bt - at;
    })
    .slice(0, limit)
    .map((o) => ({
      id: o.id,
      status: o.status,
      companyName: o.company_name,
      timestamp: o.sent_at ?? o.created_at ?? null,
    }));
}
