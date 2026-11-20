// Typed calls to the auth + onboarding endpoints. Mirrors the shapes in
// backend/app/domain/schemas.py -- keep these in sync if that file changes.
import { apiFetch, authHeaders } from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  locale: string;
  industry: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
}

export interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  job_title: string | null;
  phone: string | null;
  workspace: WorkspaceProfile;
}

export interface RegisterPayload {
  workspace_name: string;
  name: string;
  email: string;
  password: string;
  locale?: string;
}

export function registerRequest(payload: RegisterPayload) {
  return apiFetch<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginRequest(email: string, password: string) {
  return apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string) {
  return apiFetch<MeResponse>("/api/v1/auth/me", {
    headers: authHeaders(token),
  });
}

export interface OnboardingCompletePayload {
  company_name?: string;
  industry?: string;
  website?: string;
  country?: string;
  city?: string;
  company_description?: string;
  name?: string;
  job_title?: string;
  phone?: string;
}

export function completeOnboarding(token: string, payload: OnboardingCompletePayload) {
  return apiFetch<MeResponse>("/api/v1/onboarding/complete", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
