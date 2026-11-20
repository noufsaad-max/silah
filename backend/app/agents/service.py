"""
Orchestrates the three agents end-to-end and persists results to Supabase,
following the schema and call-flow in app/integrations/supabase/database.py
exactly:

    Agent 1 -> save_product() + create_run()
    Agent 2 -> save_prospect()   (one call per ranked, eligible company)
    Agent 3 -> save_outreach() + update_outreach_status()

Agent selection (mock vs real) is a constructor argument, not a global
switch, so callers choose per use -- e.g. tests keep using the mocks while
an API endpoint opts into the real agents once LLM credentials are
configured. See app/api/v1/routes/pipeline.py for how the API wires this.
"""
from pathlib import Path
from typing import Optional

from app.agents.adapters.mock import MockFitAgent, MockOutreachAgent, MockProductAgent
from app.agents.exceptions import AgentClarificationNeeded
from app.agents.interfaces import FitAgent, OutreachAgent, ProductAgent
from app.agents.schemas import (
    FitRequest,
    ICPRequest,
    OutreachRequest,
    SearchPreferences,
    SenderInfo,
)
from app.integrations.email.smtp_sender import EmailSendError, send_email as _send_email
from app.integrations.supabase import database as db

# The 500-row reference dataset vendored with Agent 2. Real deployments
# should point `companies=` at the workspace's own company data source once
# one exists (see docs/00-assumptions-and-decisions.md); this is the
# fallback so the pipeline runs end-to-end out of the box.
DEFAULT_COMPANIES_CSV = (
    Path(__file__).resolve().parent / "vendor" / "agent2_qualification" / "silah_data.csv"
)


def load_default_companies() -> list[dict]:
    from app.agents.vendor.agent2_qualification.prospect_loader import load_prospects

    return load_prospects(str(DEFAULT_COMPANIES_CSV))


class PipelineService:
    def __init__(
        self,
        product_agent: Optional[ProductAgent] = None,
        fit_agent: Optional[FitAgent] = None,
        outreach_agent: Optional[OutreachAgent] = None,
        send_email=None,
    ):
        self.product_agent = product_agent or MockProductAgent()
        self.fit_agent = fit_agent or MockFitAgent()
        self.outreach_agent = outreach_agent or MockOutreachAgent()
        # Injectable so tests (and any future non-SMTP transport) don't
        # need real SMTP credentials -- defaults to the real sender.
        self.send_email = send_email or _send_email

    def discover(
        self,
        product_name: str,
        product_description: str,
        sender_name: str,
        sender_company_name: str,
        sender_email: str,
        sender_phone: str,
        preferred_city: Optional[str] = None,
        requested_company_count: Optional[int] = None,
        companies: Optional[list[dict]] = None,
    ) -> dict:
        """Run Agent 1, then (if it doesn't need clarification) Agent 2,
        persisting product/run/prospects to Supabase as it goes.

        Returns one of:
          {"status": "needs_clarification", "clarification_question": str,
           "product": dict | None, "run": dict | None}
          {"status": "ready", "product": dict, "run": dict, "prospects": list[dict]}
        Nothing is persisted when Agent 1 needs clarification -- there is no
        product/run worth keeping yet.
        """
        icp_request = ICPRequest(
            product_name=product_name,
            product_description=product_description,
            sender_info=SenderInfo(
                name=sender_name,
                company_name=sender_company_name,
                email=sender_email,
                phone=sender_phone,
            ),
            search_preferences=SearchPreferences(
                preferred_city=preferred_city,
                requested_company_count=requested_company_count or 5,
            ),
        )
        icp_result = self.product_agent.run(icp_request)

        if icp_result.status == "needs_clarification":
            return {
                "status": "needs_clarification",
                "clarification_question": icp_result.clarification_question,
                "product": None,
                "run": None,
            }

        product_row = db.save_product(
            product_name=product_name,
            product_description=product_description,
            sender_name=sender_name,
            sender_company_name=sender_company_name,
            sender_email=sender_email,
            sender_phone=sender_phone,
        )
        run_row = db.create_run(
            product_id=product_row["id"],
            preferred_city=preferred_city,
            requested_company_count=requested_company_count,
        )

        candidate_companies = companies if companies is not None else load_default_companies()
        fit_request = FitRequest(
            icp_description=product_description,
            icp_industries=icp_result.icp_industries,
            buyer_profile=icp_result.buyer_profile,
            companies=candidate_companies,
            target_location=preferred_city,
            top_n=requested_company_count or 5,
        )

        try:
            ranked = self.fit_agent.run(fit_request)
        except AgentClarificationNeeded as need:
            # Agent 1 was confident but Agent 2's own ICP inference (only
            # reachable if icp_industries came back empty from Agent 1,
            # which "ready" should already rule out) disagreed. Surfaced
            # rather than silently swallowed; the product/run rows already
            # exist so the caller can retry Agent 2 alone once resolved.
            return {
                "status": "needs_clarification",
                "clarification_question": need.prompt_for_user or need.reason,
                "product": product_row,
                "run": run_row,
            }

        prospect_rows = [
            db.save_prospect(
                run_id=run_row["id"],
                source_company_id=company.company_id,
                company_name=company.company_name,
                fit_score=company.total_score,
                match_level=company.fit_label,
                reason=company.explanation,
                company_email=company.email,
                research_status="scored",
            )
            for company in ranked
            if company.eligible  # only companies that actually reached Stage 2 scoring
        ]

        return {"status": "ready", "product": product_row, "run": run_row, "prospects": prospect_rows}

    def draft_outreach(self, prospect: dict, product_name: str, sender: SenderInfo) -> dict:
        """Run Agent 3 for one persisted prospect row; save the draft (or the
        needs-review record) to Supabase. Returns the created outreach row.
        """
        request = OutreachRequest(
            company_id=prospect["source_company_id"],
            company_name=prospect["company_name"],
            company_email=prospect.get("company_email"),
            product_name=product_name,
            sender_name=sender.name,
            sender_company=sender.company_name,
            sender_email=sender.email,
            sender_phone=sender.phone,
        )
        draft = self.outreach_agent.run(request)

        # "needs_review" (no usable draft -- missing email, or the LLM
        # produced nothing) maps to "not_sent": there's nothing pending
        # approval yet, unlike "draft" which has real subject/body content.
        status = "draft" if draft.status == "drafted" else "not_sent"
        return db.save_outreach(
            prospect_id=prospect["id"],
            status=status,
            status_reason=draft.status_reason,
            email_subject=draft.subject,
            message=draft.body,
        )

    def approve_outreach(self, outreach_id: str) -> dict:
        """Human approval step. Does not send -- see mark_sent below."""
        return db.update_outreach_status(outreach_id, status="approved")

    def mark_sent(self, outreach_id: str) -> dict:
        """Actually send an approved draft via SMTP, then record the
        outcome.

        Deliberately a separate step from approval, and deliberately not
        routed through Agent 3's own SMTP path: that path was stripped out
        on purpose (see app/agents/vendor/CHANGES.md / RealOutreachAgent)
        because the brief calls for an explicit, backend-owned
        approve-then-send action rather than the agent sending mail
        itself. The actual sending happens here, via
        app/integrations/email/smtp_sender.py (self.send_email).

        Raises ValueError if the outreach row doesn't exist, or isn't in a
        sendable status (a route layer should map this to 422). Sendable
        means "approved" (the normal path) or "failed" (a previous send
        attempt didn't go through -- SMTP hiccup, transient network error,
        etc. -- and the approved content is still good, so the human should
        be able to just retry rather than re-approving from scratch).
        Raises SmtpNotConfiguredError (from smtp_sender) if no SMTP
        credentials are set -- a setup problem, not a per-message failure,
        so it propagates rather than silently recording success (a route
        layer should map this to 503, same pattern as real agents not
        being configured). A per-message send failure (bad recipient,
        SMTP server rejection, network error) is caught here and recorded
        as status="failed" with the reason, since that's something the
        user can see and retry, not a setup problem.
        """
        outreach_row = db.get_outreach(outreach_id)
        if outreach_row is None:
            raise ValueError(f"outreach {outreach_id!r} not found")
        if outreach_row["status"] not in ("approved", "failed"):
            raise ValueError(
                f"outreach {outreach_id!r} must be approved before it can be sent "
                f"(current status: {outreach_row['status']!r})"
            )

        prospect = db.get_prospect(outreach_row["prospect_id"])
        to_email = (prospect or {}).get("company_email")
        if not to_email:
            return db.update_outreach_status(
                outreach_id,
                status="failed",
                status_reason="No email on file for this company -- nothing to send to.",
            )

        try:
            self.send_email(
                to_email=to_email,
                subject=outreach_row.get("email_subject") or "",
                body=outreach_row.get("message") or "",
            )
        except EmailSendError as error:
            return db.update_outreach_status(outreach_id, status="failed", status_reason=str(error))

        return db.update_outreach_status(outreach_id, status="sent")
