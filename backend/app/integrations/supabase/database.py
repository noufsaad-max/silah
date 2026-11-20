"""
Supabase persistence for the agent pipeline: products -> runs -> prospects -> outreach.

This is a SEPARATE datastore from the backend's own Postgres/SQLite database
(SQLAlchemy, app/db/), which owns auth, workspaces and onboarding only. This
module owns agent-pipeline data exclusively -- written by the agent
orchestration (app/agents/service.py) and read by the dashboard endpoints.
See docs/00-assumptions-and-decisions.md ("Hybrid persistence") for why the
two stores are kept separate rather than merged into one.

Schema (created directly in the Supabase project, not via this repo's
Alembic migrations -- see infra/supabase_schema.sql for the exact DDL,
paste-ready into the Supabase SQL editor):

  products   id, product_name, product_description, sender_name,
             sender_company_name, sender_email, sender_phone, created_at
  runs       id, product_id, preferred_city, requested_company_count, created_at
  prospects  id, run_id, source_company_id, company_name, fit_score,
             match_level, reason, company_email, research_status, created_at
  outreach   id, prospect_id, status, status_reason, email_subject, message,
             reply_status, sent_at, created_at

Call flow (see app/agents/service.py):

  Agent 1 -> save_product() + create_run()
  Agent 2 -> save_prospect()  (one call per ranked company)
  Agent 3 -> save_outreach() + update_outreach_status()
  Dashboard -> get_products() / get_runs_for_product() /
               get_prospects_for_run() / get_outreach_for_prospect()
  Send step -> get_outreach() + get_prospect() (look up recipient email
               and message content before actually sending -- see
               app/agents/service.py PipelineService.mark_sent)

Credentials: SUPABASE_URL and SUPABASE_KEY come ONLY from environment
variables (loaded here through app.core.config.settings, which itself reads
the process environment / a local .env file via pydantic-settings). They
are never hardcoded in this file or anywhere else in the codebase -- do not
add a fallback literal URL or key, even for local testing.
"""
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

from app.core.config import settings
from app.core.resilience import retry_on_transient_network_error

VALID_OUTREACH_STATUSES = {
    "not_sent",
    "draft",
    "approved",
    "sent",
    "failed",
    "replied",
    "not_interested",
    "meeting_requested",
}


class SupabaseConfigError(RuntimeError):
    """SUPABASE_URL / SUPABASE_KEY are not set in the environment."""


@lru_cache(maxsize=1)
def get_client():
    """Build (and cache) the Supabase client from env-var-only credentials.

    Imports the `supabase` package lazily so the rest of the backend (auth,
    onboarding, the SQLite quick-test path) never needs it installed --
    see requirements-supabase.txt.
    """
    url = (settings.SUPABASE_URL or "").strip()
    key = (settings.SUPABASE_KEY or "").strip()
    if not url or not key:
        raise SupabaseConfigError(
            "SUPABASE_URL and SUPABASE_KEY must be set as environment variables "
            "(e.g. in backend/.env) before any agent-pipeline data can be read "
            "or written. Never hardcode these values in code."
        )
    from supabase import Client, create_client

    client: Client = create_client(url, key)
    return client


@retry_on_transient_network_error
def _execute(query):
    """Run a postgrest query's .execute(), retrying on transient
    connection-level failures -- see app/core/resilience.py for why this
    is needed and why it's safe (a real Supabase/Postgrest error, e.g. bad
    request, RLS violation, invalid status, is a distinct exception type
    raised only after a successful HTTP round-trip, so it is never caught
    or retried here; it surfaces immediately, same as before).

    Why this specifically matters for this module: get_client() caches ONE
    Supabase client (and so one underlying httpx connection pool) for the
    whole life of the process -- every request in the app funnels through
    it, so a single stale pooled connection can otherwise break every call
    that happens to reuse it next.
    """
    return query.execute()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _validate_status(status: str) -> None:
    if status not in VALID_OUTREACH_STATUSES:
        raise ValueError(
            f"invalid outreach status {status!r}; must be one of {sorted(VALID_OUTREACH_STATUSES)}"
        )


def _first_row(result, what: str) -> dict:
    if not result.data:
        raise RuntimeError(f"Supabase insert/update into {what!r} returned no row")
    return result.data[0]


# --------------------------------------------------------------------------- #
# products
# --------------------------------------------------------------------------- #


def save_product(
    product_name: str,
    product_description: str,
    sender_name: str,
    sender_company_name: str,
    sender_email: str,
    sender_phone: str,
) -> dict:
    """Insert a product/sender row (Agent 1's output). Returns the created row."""
    payload = {
        "product_name": product_name,
        "product_description": product_description,
        "sender_name": sender_name,
        "sender_company_name": sender_company_name,
        "sender_email": sender_email,
        "sender_phone": sender_phone,
    }
    result = _execute(get_client().table("products").insert(payload))
    return _first_row(result, "products")


def get_products() -> list[dict]:
    result = _execute(get_client().table("products").select("*").order("created_at", desc=True))
    return result.data or []


def get_product(product_id: str) -> Optional[dict]:
    result = _execute(get_client().table("products").select("*").eq("id", product_id).limit(1))
    return result.data[0] if result.data else None


# --------------------------------------------------------------------------- #
# runs
# --------------------------------------------------------------------------- #


def create_run(
    product_id: str,
    preferred_city: Optional[str] = None,
    requested_company_count: Optional[int] = None,
) -> dict:
    """Insert a prospect-discovery run for a product. Returns the created row."""
    payload = {
        "product_id": product_id,
        "preferred_city": preferred_city,
        "requested_company_count": requested_company_count,
    }
    result = _execute(get_client().table("runs").insert(payload))
    return _first_row(result, "runs")


def get_run(run_id: str) -> Optional[dict]:
    result = _execute(get_client().table("runs").select("*").eq("id", run_id).limit(1))
    return result.data[0] if result.data else None


def get_runs_for_product(product_id: str) -> list[dict]:
    result = _execute(
        get_client()
        .table("runs")
        .select("*")
        .eq("product_id", product_id)
        .order("created_at", desc=True)
    )
    return result.data or []


# --------------------------------------------------------------------------- #
# prospects
# --------------------------------------------------------------------------- #


def save_prospect(
    run_id: str,
    source_company_id: str,
    company_name: str,
    fit_score: Optional[float],
    match_level: Optional[str],
    reason: Optional[str],
    company_email: Optional[str],
    research_status: str = "pending",
) -> dict:
    """Insert one company scored by Agent 2 for a run. Returns the created row."""
    payload = {
        "run_id": run_id,
        "source_company_id": source_company_id,
        "company_name": company_name,
        "fit_score": fit_score,
        "match_level": match_level,
        "reason": reason,
        "company_email": company_email,
        "research_status": research_status,
    }
    result = _execute(get_client().table("prospects").insert(payload))
    return _first_row(result, "prospects")


def get_prospect(prospect_id: str) -> Optional[dict]:
    result = _execute(get_client().table("prospects").select("*").eq("id", prospect_id).limit(1))
    return result.data[0] if result.data else None


def get_prospects_for_run(run_id: str) -> list[dict]:
    result = _execute(
        get_client()
        .table("prospects")
        .select("*")
        .eq("run_id", run_id)
        .order("fit_score", desc=True)
    )
    return result.data or []


# --------------------------------------------------------------------------- #
# outreach
# --------------------------------------------------------------------------- #


def save_outreach(
    prospect_id: str,
    status: str = "not_sent",
    status_reason: Optional[str] = None,
    email_subject: Optional[str] = None,
    message: Optional[str] = None,
    reply_status: Optional[str] = None,
    sent_at: Optional[str] = None,
) -> dict:
    """Insert Agent 3's draft/send record for a prospect. Returns the created row."""
    _validate_status(status)
    payload = {
        "prospect_id": prospect_id,
        "status": status,
        "status_reason": status_reason,
        "email_subject": email_subject,
        "message": message,
        "reply_status": reply_status,
        "sent_at": sent_at,
    }
    result = _execute(get_client().table("outreach").insert(payload))
    return _first_row(result, "outreach")


def update_outreach_status(
    outreach_id: str,
    status: str,
    status_reason: Optional[str] = None,
    sent_at: Optional[str] = None,
) -> dict:
    """Move an outreach record to a new status (e.g. draft -> approved -> sent, or -> replied)."""
    _validate_status(status)
    payload: dict[str, Any] = {"status": status}
    if status_reason is not None:
        payload["status_reason"] = status_reason
    if status == "sent" and sent_at is None:
        sent_at = _now_iso()
    if sent_at is not None:
        payload["sent_at"] = sent_at
    result = _execute(get_client().table("outreach").update(payload).eq("id", outreach_id))
    return _first_row(result, "outreach")


def get_outreach(outreach_id: str) -> Optional[dict]:
    result = _execute(get_client().table("outreach").select("*").eq("id", outreach_id).limit(1))
    return result.data[0] if result.data else None


def get_outreach_for_prospect(prospect_id: str) -> list[dict]:
    result = _execute(
        get_client()
        .table("outreach")
        .select("*")
        .eq("prospect_id", prospect_id)
        .order("created_at", desc=True)
    )
    return result.data or []
