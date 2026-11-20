"""
Shapes exchanged with the Product / Fit / Outreach agents.

These match the REAL agents vendored from ghadahHameed/silah-multi-agent-SDA
(see app/agents/vendor/) rather than speculative shapes written before their
code existed. Notable differences from the product brief's own description
(documented plainly, not hidden):

- The brief's "Score breakdown" (Industry Relevance 35% / Observable Need
  Signals 30% / Operational Fit 20% / Growth Signals 15%) is NOT what Agent 2
  actually computes. Its real formula is
  fit_score = 0.30*industry_score + 0.30*revenue_score + 0.40*description_score
  -- three factors, different weights, and description_score comes from an
  LLM judging the company's business_description against the product
  description (not "observable need signals" in any structured sense).
  ScoreFactorResult.factor is populated with the real factor names
  ("industry", "revenue", "description"), not the brief's four.
- Agent 1's output is ICP industries (from a fixed taxonomy of ~45 named
  industries) plus a one-sentence buyer_profile, not the richer
  likely_buyers/operational_signals/keywords this file originally
  speculated.
- Agent 2 is a two-stage pipeline: a free/local pre-filter (location ->
  industry -> revenue -> rank-cap) narrows the field before the LLM ever
  runs, so most companies in a batch are never scored by the LLM at all --
  RankedCompany.eligible reflects whether a company reached that LLM stage,
  not whether it "qualifies" in a business sense.

Whatever an agent produces must still validate against these exactly --
reject silently-wrong shapes rather than coercing them. See
docs/01-architecture.md and app/agents/vendor/CHANGES.md.
"""
from pydantic import BaseModel


class SenderInfo(BaseModel):
    name: str
    company_name: str
    email: str
    phone: str


class SearchPreferences(BaseModel):
    preferred_city: str | None = None
    requested_company_count: int = 5


class ICPRequest(BaseModel):
    product_name: str
    product_description: str
    sender_info: SenderInfo
    search_preferences: SearchPreferences = SearchPreferences()


class ICPResult(BaseModel):
    status: str  # "ready" | "needs_clarification"
    icp_industries: list[str]
    buyer_profile: str
    sender_info: SenderInfo
    search_preferences: SearchPreferences
    clarification_question: str | None = None


class FitRequest(BaseModel):
    # The product description, judged by the LLM against each company's
    # business_description (Agent 2 calls this the ICP "description").
    icp_description: str
    icp_industries: list[str] = []
    buyer_profile: str | None = None
    # Raw company records. See app/agents/adapters/real_fit.py
    # (_to_vendor_company) for the exact field-mapping seam between our
    # `companies` table shape and what Agent 2 expects.
    companies: list[dict]
    target_location: str | None = None
    top_n: int = 7


class ScoreFactorResult(BaseModel):
    factor: str  # "industry" | "revenue" | "description"
    raw_score: float | None  # None = never scored (cut before this stage)
    evidence: dict | None = None
    missing_reason: str | None = None


class RankedCompany(BaseModel):
    company_id: str
    company_name: str
    eligible: bool  # reached Stage 2 (LLM description scoring)
    exclusion_reason: str | None = None  # e.g. "industry", "revenue", "rank", "location", "skipped"
    total_score: float | None = None  # fit_score, only set when eligible
    coverage: float | None = None  # fraction of the 3 factors that were actually scored
    fit_label: str | None = None  # "high match" | "medium match" | "low match"
    factors: list[ScoreFactorResult]
    explanation: str | None = None  # the LLM's one-sentence verdict, when available
    email: str | None = None


class OutreachRequest(BaseModel):
    company_id: str
    company_name: str
    company_email: str | None
    product_name: str
    sender_name: str
    sender_company: str
    sender_email: str
    sender_phone: str


class DraftMessage(BaseModel):
    subject: str | None
    body: str | None
    status: str  # "drafted" | "needs_review"
    status_reason: str
