"""
Deterministic fake agents so every downstream screen and test can be built
without live LLM calls. Match the shapes the real agents produce (see
app/agents/schemas.py) so swapping in RealProductAgent / RealFitAgent /
RealOutreachAgent (app/agents/adapters/real_*.py) is a drop-in change at the
call site -- see docs/01-architecture.md ("Agent integration contract").
"""
from app.agents.interfaces import FitAgent, OutreachAgent, ProductAgent
from app.agents.schemas import (
    DraftMessage,
    FitRequest,
    ICPRequest,
    ICPResult,
    OutreachRequest,
    RankedCompany,
    ScoreFactorResult,
    SearchPreferences,
)


class MockProductAgent(ProductAgent):
    def run(self, request: ICPRequest) -> ICPResult:
        return ICPResult(
            status="ready",
            icp_industries=["Technology"],
            buyer_profile=(
                f"Mock buyer profile for {request.product_name} -- replace with "
                "real Product Agent output."
            ),
            sender_info=request.sender_info,
            search_preferences=request.search_preferences or SearchPreferences(),
            clarification_question=None,
        )


class MockFitAgent(FitAgent):
    def run(self, request: FitRequest) -> list[RankedCompany]:
        results = []
        for company in request.companies[: request.top_n]:
            company_id = str(company.get("company_id") or company.get("id") or "unknown")
            company_name = company.get("company_name") or company.get("name") or "Unknown Company"
            factors = [
                ScoreFactorResult(factor="industry", raw_score=0.8),
                ScoreFactorResult(factor="revenue", raw_score=0.6),
                ScoreFactorResult(
                    factor="description",
                    raw_score=None,
                    missing_reason="Mock mode -- no LLM call made",
                ),
            ]
            results.append(
                RankedCompany(
                    company_id=company_id,
                    company_name=company_name,
                    eligible=True,
                    total_score=0.68,
                    coverage=2 / 3,
                    fit_label="medium match",
                    factors=factors,
                    explanation="Mock scoring -- replace with real Fit Agent output.",
                    email=company.get("email"),
                )
            )
        return results


class MockOutreachAgent(OutreachAgent):
    def run(self, request: OutreachRequest) -> DraftMessage:
        if not request.company_email:
            return DraftMessage(
                subject=None,
                body=None,
                status="needs_review",
                status_reason="Missing company email. Needs human review.",
            )
        return DraftMessage(
            subject=f"Quick question about {request.company_name}'s goals",
            body=(
                f"Hi {request.company_name} team,\n\n"
                f"[Mock draft for {request.product_name} -- replace with real "
                "Outreach Agent output]\n\n"
                f"Best,\n{request.sender_name}\n{request.sender_company}\n"
                f"{request.sender_email} | {request.sender_phone}"
            ),
            status="drafted",
            status_reason="Mock draft, not reviewed by a human.",
        )
