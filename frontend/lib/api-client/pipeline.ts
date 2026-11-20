// Typed calls to the agent-pipeline endpoints. Mirrors the shapes in
// backend/app/api/v1/routes/pipeline.py -- keep these in sync if that file
// changes. See docs/01-architecture.md ("Agent integration contract") for
// what each field means and where it comes from (Agent 1/2/3).
import { apiFetch, authHeaders } from "./client";

export type OutreachStatus =
  | "not_sent"
  | "draft"
  | "approved"
  | "sent"
  | "failed"
  | "replied"
  | "not_interested"
  | "meeting_requested";

export type MatchLevel = "high match" | "medium match" | "low match";

export interface Product {
  id: string;
  product_name: string;
  product_description: string;
  sender_name: string;
  sender_company_name: string;
  sender_email: string;
  sender_phone: string;
  created_at?: string;
}

export interface Run {
  id: string;
  product_id: string;
  preferred_city: string | null;
  requested_company_count: number | null;
  created_at?: string;
}

export interface Prospect {
  id: string;
  run_id: string;
  source_company_id: string;
  company_name: string;
  fit_score: number | null;
  match_level: MatchLevel | null;
  reason: string | null;
  company_email: string | null;
  research_status: string;
  created_at?: string;
}

// Returned by /prospects (the cross-product aggregate) -- a Prospect plus
// which product/run it belongs to, joined in server-side.
export interface ProspectWithContext extends Prospect {
  product_id: string;
  product_name: string;
}

// Returned by GET /prospects/{id} -- a Prospect plus its full owning
// Product (needed to draft outreach: sender name/company/email/phone).
export interface ProspectDetail extends Prospect {
  product: Product | null;
}

// Returned by /runs/{id}/prospects-with-outreach -- a Prospect plus its
// latest outreach status, joined in server-side.
export interface ProspectWithOutreach extends Prospect {
  outreach_id: string | null;
  outreach_status: OutreachStatus;
  email_subject: string | null;
}

export interface Outreach {
  id: string;
  prospect_id: string;
  status: OutreachStatus;
  status_reason: string | null;
  email_subject: string | null;
  message: string | null;
  reply_status: string | null;
  sent_at: string | null;
  created_at?: string;
}

// Returned by /outreach (the cross-product aggregate) -- an Outreach row
// plus the company/product it belongs to, joined in server-side.
export interface OutreachWithContext extends Outreach {
  company_name: string;
  company_email: string | null;
  product_id: string;
  product_name: string;
}

export interface SenderInfo {
  name: string;
  company_name: string;
  email: string;
  phone: string;
}

export interface DiscoverPayload {
  product_name: string;
  product_description: string;
  sender_name: string;
  sender_company_name: string;
  sender_email: string;
  sender_phone: string;
  preferred_city?: string;
  requested_company_count?: number;
  companies?: Record<string, unknown>[];
}

export type DiscoverResult =
  | { status: "ready"; product: Product; run: Run; prospects: Prospect[] }
  | {
      status: "needs_clarification";
      clarification_question: string | null;
      product: Product | null;
      run: Run | null;
    };

export function discover(token: string, payload: DiscoverPayload, useRealAgents = false) {
  return apiFetch<DiscoverResult>(`/api/v1/pipeline/discover?use_real_agents=${useRealAgents}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function getProducts(token: string) {
  return apiFetch<Product[]>("/api/v1/pipeline/products", { headers: authHeaders(token) });
}

export function getProduct(token: string, productId: string) {
  return apiFetch<Product>(`/api/v1/pipeline/products/${productId}`, { headers: authHeaders(token) });
}

export function getRunsForProduct(token: string, productId: string) {
  return apiFetch<Run[]>(`/api/v1/pipeline/products/${productId}/runs`, { headers: authHeaders(token) });
}

export function getProspectsForRun(token: string, runId: string) {
  return apiFetch<Prospect[]>(`/api/v1/pipeline/runs/${runId}/prospects`, { headers: authHeaders(token) });
}

export function getProspectsWithOutreachForRun(token: string, runId: string) {
  return apiFetch<ProspectWithOutreach[]>(`/api/v1/pipeline/runs/${runId}/prospects-with-outreach`, {
    headers: authHeaders(token),
  });
}

export function getProspect(token: string, prospectId: string) {
  return apiFetch<ProspectDetail>(`/api/v1/pipeline/prospects/${prospectId}`, { headers: authHeaders(token) });
}

export function getAllProspects(token: string) {
  return apiFetch<ProspectWithContext[]>("/api/v1/pipeline/prospects", { headers: authHeaders(token) });
}

export function getOutreachForProspect(token: string, prospectId: string) {
  return apiFetch<Outreach[]>(`/api/v1/pipeline/prospects/${prospectId}/outreach`, {
    headers: authHeaders(token),
  });
}

export function getAllOutreach(token: string) {
  return apiFetch<OutreachWithContext[]>("/api/v1/pipeline/outreach", { headers: authHeaders(token) });
}

export function draftOutreach(
  token: string,
  prospectId: string,
  payload: { product_name: string; sender: SenderInfo },
  useRealAgents = false
) {
  return apiFetch<Outreach>(
    `/api/v1/pipeline/prospects/${prospectId}/draft-outreach?use_real_agents=${useRealAgents}`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(payload) }
  );
}

export function approveOutreach(token: string, outreachId: string) {
  return apiFetch<Outreach>(`/api/v1/pipeline/outreach/${outreachId}/approve`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function sendOutreach(token: string, outreachId: string) {
  return apiFetch<Outreach>(`/api/v1/pipeline/outreach/${outreachId}/send`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function updateOutreachStatus(
  token: string,
  outreachId: string,
  payload: { status: OutreachStatus; status_reason?: string }
) {
  return apiFetch<Outreach>(`/api/v1/pipeline/outreach/${outreachId}/status`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
