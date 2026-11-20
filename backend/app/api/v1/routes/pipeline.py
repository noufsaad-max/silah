"""
Agent-pipeline endpoints: run the three agents and read back what they
produced. Persistence is Supabase (app/integrations/supabase/database.py),
separate from this app's own Postgres/SQLite auth database -- see
docs/00-assumptions-and-decisions.md ("Hybrid persistence").

Every endpoint here requires a logged-in user (get_current_user) but the
agent-pipeline data itself is not workspace-scoped in Supabase yet -- see
the note on ProductCreateRequest below.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.agents.schemas import SenderInfo
from app.agents.service import PipelineService
from app.core.deps import get_current_user
from app.integrations.supabase import database as db
from app.integrations.supabase.database import SupabaseConfigError

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def _service(use_real_agents: bool) -> PipelineService:
    if not use_real_agents:
        return PipelineService()
    # Real adapters are imported lazily inside their own __init__ (see
    # app/agents/adapters/real_*.py), so constructing them is where a
    # missing LLM_MODEL/LLM_API_KEY/SILAH_OPENAI_API_KEY first surfaces.
    from app.agents.adapters.real_fit import RealFitAgent
    from app.agents.adapters.real_outreach import RealOutreachAgent
    from app.agents.adapters.real_product import RealProductAgent

    try:
        return PipelineService(
            product_agent=RealProductAgent(),
            fit_agent=RealFitAgent(),
            outreach_agent=RealOutreachAgent(),
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Real agents are not configured: {error}",
        ) from error


def _with_supabase_errors(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except SupabaseConfigError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


# --------------------------------------------------------------------------- #
# Run the pipeline
# --------------------------------------------------------------------------- #


class DiscoverRequest(BaseModel):
    # NOTE: the agent-pipeline schema (see docs/02-database-schema.md /
    # the Supabase handoff) has no workspace_id column -- product/run/
    # prospect/outreach rows are shared across the whole Supabase project,
    # not scoped per Silah workspace the way the auth database is. Fine for
    # the current single-team use; flag before multi-tenant use.
    product_name: str
    product_description: str
    sender_name: str
    sender_company_name: str
    sender_email: str
    sender_phone: str
    preferred_city: Optional[str] = None
    requested_company_count: Optional[int] = None
    # Optional override of the candidate company pool; defaults to Agent 2's
    # bundled 500-row reference dataset (see app/agents/service.py).
    companies: Optional[list[dict]] = None


@router.post("/discover")
def discover(
    payload: DiscoverRequest,
    use_real_agents: bool = Query(False, description="Use the real LLM-backed agents instead of the mocks."),
    _user=Depends(get_current_user),
):
    """Run Agent 1 (Product) then Agent 2 (Fit), saving product/run/prospects
    to Supabase. May instead come back with status="needs_clarification" if
    the product description doesn't say who the buyer is -- nothing is
    persisted in that case; resubmit with a fuller product_description.
    """
    service = _service(use_real_agents)
    result = _with_supabase_errors(
        service.discover,
        product_name=payload.product_name,
        product_description=payload.product_description,
        sender_name=payload.sender_name,
        sender_company_name=payload.sender_company_name,
        sender_email=payload.sender_email,
        sender_phone=payload.sender_phone,
        preferred_city=payload.preferred_city,
        requested_company_count=payload.requested_company_count,
        companies=payload.companies,
    )
    return result


class DraftOutreachRequest(BaseModel):
    product_name: str
    sender: SenderInfo


@router.post("/prospects/{prospect_id}/draft-outreach")
def draft_outreach(
    prospect_id: str,
    payload: DraftOutreachRequest,
    use_real_agents: bool = Query(False, description="Use the real LLM-backed agent instead of the mock."),
    _user=Depends(get_current_user),
):
    """Run Agent 3 for one prospect and save the draft (or needs-review
    record) to Supabase."""
    prospect = _with_supabase_errors(db.get_prospect, prospect_id=prospect_id)
    if prospect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")

    service = _service(use_real_agents)
    outreach_row = _with_supabase_errors(
        service.draft_outreach, prospect=prospect, product_name=payload.product_name, sender=payload.sender
    )
    return outreach_row


@router.post("/outreach/{outreach_id}/approve")
def approve_outreach(outreach_id: str, _user=Depends(get_current_user)):
    """Human approval step -- does not send. See /outreach/{id}/send."""
    return _with_supabase_errors(PipelineService().approve_outreach, outreach_id=outreach_id)


@router.post("/outreach/{outreach_id}/send")
def send_outreach(outreach_id: str, _user=Depends(get_current_user)):
    """Actually sends the approved draft via SMTP and records the outcome
    -- see PipelineService.mark_sent / app/integrations/email/smtp_sender.py."""
    from app.integrations.email.smtp_sender import SmtpNotConfiguredError

    try:
        return _with_supabase_errors(PipelineService().mark_sent, outreach_id=outreach_id)
    except SmtpNotConfiguredError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


class OutreachStatusUpdate(BaseModel):
    status: str
    status_reason: Optional[str] = None


@router.patch("/outreach/{outreach_id}/status")
def update_outreach_status(outreach_id: str, payload: OutreachStatusUpdate, _user=Depends(get_current_user)):
    """Free-form status update for outcomes an agent doesn't produce itself
    (e.g. marking a reply as "replied", "not_interested" or
    "meeting_requested" after a human reads it)."""
    try:
        return _with_supabase_errors(
            db.update_outreach_status,
            outreach_id=outreach_id,
            status=payload.status,
            status_reason=payload.status_reason,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error


# --------------------------------------------------------------------------- #
# Dashboard reads -- Product -> Run -> Companies -> Outreach Status
# --------------------------------------------------------------------------- #


@router.get("/products")
def list_products(_user=Depends(get_current_user)):
    return _with_supabase_errors(db.get_products)


@router.get("/products/{product_id}")
def get_product(product_id: str, _user=Depends(get_current_user)):
    product = _with_supabase_errors(db.get_product, product_id=product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/products/{product_id}/runs")
def list_runs(product_id: str, _user=Depends(get_current_user)):
    return _with_supabase_errors(db.get_runs_for_product, product_id=product_id)


@router.get("/runs/{run_id}/prospects")
def list_prospects(run_id: str, _user=Depends(get_current_user)):
    return _with_supabase_errors(db.get_prospects_for_run, run_id=run_id)


@router.get("/runs/{run_id}/prospects-with-outreach")
def list_prospects_with_outreach(run_id: str, _user=Depends(get_current_user)):
    """Same rows as /runs/{id}/prospects, with each prospect's latest
    outreach status/subject/id joined in server-side -- saves the ranked-
    results table from firing an outreach fetch per row."""
    prospects = _with_supabase_errors(db.get_prospects_for_run, run_id=run_id)
    enriched = []
    for prospect in prospects:
        outreach_rows = _with_supabase_errors(db.get_outreach_for_prospect, prospect_id=prospect["id"])
        # get_outreach_for_prospect orders by created_at desc -- [0] is latest
        latest = outreach_rows[0] if outreach_rows else None
        enriched.append(
            {
                **prospect,
                "outreach_id": latest["id"] if latest else None,
                "outreach_status": latest["status"] if latest else "not_sent",
                "email_subject": latest["email_subject"] if latest else None,
            }
        )
    return enriched


@router.get("/prospects/{prospect_id}")
def get_prospect(prospect_id: str, _user=Depends(get_current_user)):
    """Unlike /runs/{id}/prospects, this joins in the owning product (name +
    sender info) -- the prospect detail page needs sender_name/company/
    email/phone to draft outreach, and a bare prospect row only carries
    run_id, not product_id."""
    prospect = _with_supabase_errors(db.get_prospect, prospect_id=prospect_id)
    if prospect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prospect not found")
    run = _with_supabase_errors(db.get_run, run_id=prospect["run_id"])
    product = _with_supabase_errors(db.get_product, product_id=run["product_id"]) if run else None
    return {**prospect, "product": product}


@router.get("/prospects/{prospect_id}/outreach")
def list_outreach(prospect_id: str, _user=Depends(get_current_user)):
    return _with_supabase_errors(db.get_outreach_for_prospect, prospect_id=prospect_id)


def _iter_all_prospects():
    """Yield (product, run, prospect) for every prospect across every
    product/run. Loops products -> runs -> prospects server-side (three
    levels of Supabase calls) -- acceptable at this MVP's data scale; the
    handoff spec has no single cross-product prospect listing, so this is
    what backs the Prospects and Messages pages instead of adding an index
    table that doesn't exist in the agreed schema."""
    for product in _with_supabase_errors(db.get_products):
        for run in _with_supabase_errors(db.get_runs_for_product, product_id=product["id"]):
            for prospect in _with_supabase_errors(db.get_prospects_for_run, run_id=run["id"]):
                yield product, run, prospect


@router.get("/prospects")
def list_all_prospects(_user=Depends(get_current_user)):
    """Every prospect across every product/run, with product/run context
    joined in -- backs the cross-campaign Prospects page."""
    return [
        {**prospect, "product_id": product["id"], "product_name": product["product_name"], "run_id": run["id"]}
        for product, run, prospect in _iter_all_prospects()
    ]


@router.get("/outreach")
def list_all_outreach(_user=Depends(get_current_user)):
    """Every outreach record across every prospect, with company/product
    context joined in -- backs the Messages page's status tabs."""
    result = []
    for product, run, prospect in _iter_all_prospects():
        for row in _with_supabase_errors(db.get_outreach_for_prospect, prospect_id=prospect["id"]):
            result.append(
                {
                    **row,
                    "company_name": prospect["company_name"],
                    "company_email": prospect.get("company_email"),
                    "product_id": product["id"],
                    "product_name": product["product_name"],
                }
            )
    return result
