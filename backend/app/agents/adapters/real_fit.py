 """
Adapter wrapping the real Fit/Qualification Agent vendored from
ghadahHameed/silah-multi-agent-SDA (branch agent-2). See
app/agents/vendor/agent2_qualification/ and vendor/CHANGES.md.

Calls scoring.rank_prospects directly (not
qualification_agent.qualify_prospects, which insists on loading a CSV file)
so callers can pass our own company records -- converted to the exact dict
shape Agent 2 expects -- rather than a static file. See
docs/02-database-schema.md for our own `companies` shape; _to_vendor_company
below is the field-mapping seam between the two.

We read `evaluation_log` (populated in place by rank_prospects for EVERY
company, not just the selected top-N) rather than rank_prospects's own
return value. Its return value is a list of `build_handoff` dicts -- only
the selected companies, and each one drops `company_id` -- while
evaluation_log has one entry per company with the real stage it reached
(scored / pre-filtered / skipped / location-filtered / not-evaluated), the
gate that excluded it, and every component score. That is what
RankedCompany.eligible / .exclusion_reason / .factors need.

Vendor code is imported lazily (inside __init__), not at module load time,
so importing this file never eagerly constructs an LLM/embedding client or
requires SILAH_OPENAI_API_KEY to be set -- only actually using the adapter
does. This matters because MockFitAgent stays the default until a caller
explicitly asks for RealFitAgent.
"""
from app.agents.exceptions import AgentClarificationNeeded
from app.agents.interfaces import FitAgent
from app.agents.schemas import FitRequest, RankedCompany, ScoreFactorResult


def _to_vendor_company(company: dict) -> dict:
    """
    Map our company shape to exactly what Agent 2 expects: company_id,
    company_name, industry, location, business_description, website,
    email, revenue_sar. Falls back across our own field-name variants
    (id/company_id, name/company_name, description/business_description,
    city/location, annual_revenue/revenue_sar, website_domain/website) so
    this stays tolerant of whichever shape the caller has on hand.
    """
    return {
        "company_id": str(company.get("company_id") or company.get("id") or ""),
        "company_name": company.get("company_name") or company.get("name") or "",
        "industry": company.get("industry") or "",
        "location": company.get("location") or company.get("city") or "",
        "business_description": (
            company.get("business_description") or company.get("description") or ""
        ),
        "website": company.get("website") or company.get("website_domain") or None,
        "email": company.get("email") or None,
        "revenue_sar": company.get("revenue_sar") or company.get("annual_revenue"),
    }


class RealFitAgent(FitAgent):
    def __init__(self):
        from app.agents.vendor.agent2_qualification.scoring import (
            ClarificationNeeded,
            match_level,
            rank_prospects,
        )

        self._rank_prospects = rank_prospects
        self._ClarificationNeeded = ClarificationNeeded
        self._match_level = match_level

    def run(self, request: FitRequest) -> list[RankedCompany]:
        vendor_companies = [_to_vendor_company(c) for c in request.companies]
        by_id = {c["company_id"]: c for c in vendor_companies if c["company_id"]}

        evaluation_log: list = []
        try:
            self._rank_prospects(
                vendor_companies,
                request.icp_description,
                icp_industries=request.icp_industries or None,
                buyer_profile=request.buyer_profile,
                top_n=request.top_n,
                evaluation_log=evaluation_log,
                log_path=None,
                target_location=request.target_location,
            )
        except self._ClarificationNeeded as need:
            raise AgentClarificationNeeded(
                reason=getattr(need, "reason", str(need)),
                prompt_for_user=getattr(need, "prompt_for_user", None),
            ) from need

        ranked_companies = [self._to_ranked_company(entry, by_id) for entry in evaluation_log]
        return self._cap_to_top_n(ranked_companies, request.top_n)

    @staticmethod
    def _cap_to_top_n(companies: list[RankedCompany], top_n: int | None) -> list[RankedCompany]:
        """rank_prospects's own `top_n` parameter only slices its return
        value (see the module docstring -- we don't use that return value,
        we use evaluation_log instead). evaluation_log has one "scored"
        entry for every company that reached Stage 2, which is capped at
        LLM_PREFILTER_TOP_N (20 -- see scoring_config.py), not at the
        caller's requested top_n. Without this, a request for the top 5
        companies would come back with up to 20 "eligible" rows.

        Apply the user's requested count here instead: keep only the
        top_n highest-scoring eligible companies, demoting the rest to
        ineligible with exclusion_reason="rank" -- the same label
        rank_prospects itself uses for its own pre-filter cap, so
        downstream code (service.py filters on `.eligible`) and the UI
        don't need a separate concept for "scored but not selected".
        """
        if not top_n or top_n <= 0:
            return companies

        eligible_sorted = sorted(
            (c for c in companies if c.eligible),
            key=lambda c: c.total_score if c.total_score is not None else float("-inf"),
            reverse=True,
        )
        keep_ids = {c.company_id for c in eligible_sorted[:top_n]}

        return [
            c
            if not c.eligible or c.company_id in keep_ids
            else c.model_copy(update={"eligible": False, "exclusion_reason": "rank"})
            for c in companies
        ]

    def _to_ranked_company(self, entry: dict, by_id: dict) -> RankedCompany:
        stage = entry.get("stage")
        fit_score = entry.get("fit_score")
        eligible = stage == "scored" and fit_score is not None

        exclusion_reason = None
        if not eligible:
            # pre_filter_cut is "industry" | "revenue" | "rank" for a
            # pre-filtered company; other stages ("location-filtered",
            # "skipped", "not-evaluated") speak for themselves.
            exclusion_reason = entry.get("pre_filter_cut") or stage

        def _factor(name: str, raw_score) -> ScoreFactorResult:
            return ScoreFactorResult(
                factor=name,
                raw_score=raw_score,
                missing_reason=None if raw_score is not None else f"not scored (stage={stage})",
            )

        factors = [
            _factor("industry", entry.get("industry_score")),
            _factor("revenue", entry.get("revenue_score")),
            _factor("description", entry.get("description_score")),
        ]
        coverage = sum(1 for f in factors if f.raw_score is not None) / 3

        company = by_id.get(entry.get("company_id"), {})
        reasoning = entry.get("reasoning") or []
        explanation = entry.get("description_reasoning") or (reasoning[-1] if reasoning else None)

        return RankedCompany(
            company_id=str(entry.get("company_id") or ""),
            company_name=entry.get("company_name") or "",
            eligible=eligible,
            exclusion_reason=exclusion_reason,
            total_score=fit_score,
            coverage=coverage,
            fit_label=self._match_level(fit_score) if fit_score is not None else None,
            factors=factors,
            explanation=explanation,
            email=company.get("email"),
        )
