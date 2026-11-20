# 01 — Architecture and Folder Structure

## System overview

```
Browser (Next.js SSR/CSR, AR/EN, light/dark)
        |
        | REST/JSON — typed client generated from the backend's OpenAPI schema
        v
FastAPI backend  ---->  PostgreSQL/SQLite  (auth, workspaces, onboarding — app/db/)
   |        |
   |        +--> Supabase (products/runs/prospects/outreach — app/integrations/supabase/)
   |                  a SEPARATE datastore from the line above; see 00-assumptions-and-decisions.md
   |                  ("Persistence: hybrid, two datastores")
   |
   +--> Agent adapters (Product / Fit / Outreach) — app/agents/adapters/
   |         |
   |         +--> in-process Python calls into app/agents/vendor/ (the real agents,
   |                vendored from ghadahHameed/silah-multi-agent-SDA) OR the mock
   |                adapters (app/agents/adapters/mock.py), selected per call by the
   |                caller — see "Agent integration contract" below
   |
   +--> Object storage (signed URLs) for uploaded CSV/XLSX — not yet built
   +--> Email provider adapter — app/integrations/email/smtp_sender.py (plain
        SMTP, e.g. Gmail); see app/agents/vendor/CHANGES.md for why Agent 3's
        own SMTP path isn't used instead, and PipelineService.mark_sent for
        the approve-then-send flow that calls it
```

## Keeping frontend and backend in sync
This two-service split (Next.js + FastAPI, rather than the brief's single-Next.js default) means the
API contract needs explicit discipline. FastAPI auto-generates an OpenAPI schema for free; generate a
typed TypeScript client from it as a build step (`openapi-typescript-codegen` or `orval`) so the
frontend never hand-writes fetch calls or duplicates response types. Regenerate the client whenever a
route in `backend/app/api/v1/routes/` changes shape.

## Backend folder structure (`/backend`)

```
backend/
  app/
    main.py                    # FastAPI app, router registration, middleware
    core/
      config.py                 # env-based settings (pydantic-settings)
      security.py                # JWT issuing/verification, password hashing
      deps.py                     # shared deps: current_user, current_workspace, require_role
    api/v1/routes/
      auth.py
      onboarding.py
      pipeline.py                  # run the agents + dashboard reads (Product→Run→Companies→Outreach)
      health.py
      # not yet built: campaigns.py, imports.py, contacts.py, messages.py, webhooks.py
    domain/                     # Pydantic request/response schemas mirroring the auth/workspace data model
    db/
      models.py                  # SQLAlchemy models (auth/workspace/user only — NOT the agent pipeline)
      session.py
    integrations/
      supabase/
        database.py                # agent-pipeline persistence: products/runs/prospects/outreach.
                                    # SUPABASE_URL / SUPABASE_KEY from env only, see .env.example
    agents/
      interfaces.py                 # ProductAgent / FitAgent / OutreachAgent abstract contracts
      schemas.py                     # request/result shapes matching the REAL vendored agents
      exceptions.py                   # AgentClarificationNeeded
      service.py                       # PipelineService — orchestrates agents + Supabase, called by api/v1/routes/pipeline.py
      adapters/
        mock.py                       # deterministic fake agents — the safe default, no LLM calls
        real_product.py                 # wraps vendor/agent1_product
        real_fit.py                      # wraps vendor/agent2_qualification
        real_outreach.py                  # wraps vendor/agent3_outreach (drafting only — see CHANGES.md)
      vendor/
        CHANGES.md                    # every modification made to the vendored code, and why
        agent1_product/                 # from ghadahHameed/silah-multi-agent-SDA, branch agent-1
        agent2_qualification/            # branch agent-2, plus its bundled silah_data.csv reference dataset
        agent3_outreach/                  # branch agent-3
    tests/
  alembic/                          # DB migrations (auth/workspace schema only)
  requirements.txt                  # base app: auth, onboarding, SQLite/Postgres — no agent deps
  requirements-agents.txt           # + langchain, sentence-transformers, openai, etc. — only for real_*.py
  requirements-supabase.txt         # + supabase client — only for integrations/supabase/database.py
  pyproject.toml
```

## Frontend folder structure (`/frontend`, Next.js App Router)

```
frontend/
  app/
    [locale]/                      # "ar" | "en" — drives RTL/LTR at the layout level
      (auth)/
        login/
        onboarding/
      (app)/
        overview/
        campaigns/
          [campaignId]/
        prospects/
          [prospectId]/
        messages/
        imports/
        settings/
  components/
    ui/                            # shadcn/ui primitives
    data-display/                   # score badges, coverage bars, status chips (never color-only)
  lib/
    api-client/                     # generated from backend OpenAPI — never hand-edited
    i18n/                            # ar.json / en.json — no hard-coded UI copy anywhere
    theme/
  tests/
    unit/                           # Vitest
    e2e/                             # Playwright
```

## Local dev environment (`/infra`)
`docker-compose.yml` brings up `postgres`, `backend` (FastAPI, hot reload), `frontend` (Next.js dev
server). `redis` is deferred until/unless Celery replaces the MVP job-table worker.

## Agent integration contract

Three abstract interfaces live in `backend/app/agents/interfaces.py`. The shapes in
`backend/app/agents/schemas.py` were revised once the real agents' code arrived to match what they
actually produce, not the brief's original speculative shapes — every deviation is documented in the
schemas.py module docstring and in `vendor/CHANGES.md`. In short:

- `ProductAgent.run(ICPRequest) -> ICPResult` — `ICPResult.icp_industries` (from a fixed ~45-industry
  taxonomy) + a one-sentence `buyer_profile`, or `status="needs_clarification"` if the product
  description doesn't say who buys it.
- `FitAgent.run(FitRequest) -> list[RankedCompany]` — one entry per candidate company, `eligible=True`
  only for the ones that reached the LLM description-scoring stage (most won't — see the two-stage
  pipeline below). `total_score` is `fit_score = 0.30*industry_score + 0.30*revenue_score +
  0.40*description_score` — a real, different formula from the brief's four-factor 35/30/20/15
  breakdown.
- `OutreachAgent.run(OutreachRequest) -> DraftMessage` — `status="drafted"` with subject/body, or
  `"needs_review"` (missing company email, or nothing usable came back). Drafting only — no send.

Both `adapters/mock.py` (deterministic, no LLM calls — the safe default) and `adapters/real_*.py`
(wrapping the vendored agents) satisfy the same interfaces, so callers (see
`app/agents/service.py::PipelineService`) can swap one for the other without any other code changing.
`adapters/real_*.py` import their vendor module lazily, inside `__init__`, so constructing
`MockFitAgent()` never requires `SILAH_OPENAI_API_KEY` etc. to be set — only constructing `RealFitAgent()`
does.

### Agent 2's two-stage pipeline (why most companies never reach the LLM)
Stage 1 is a free, local pre-filter over every candidate: location (optional exact match) → industry
(fuzzy taxonomy match) → revenue tier → rank-cap to the top `prefilter_top_n` survivors. A company that
fails any gate is excluded with that gate's name in `RankedCompany.exclusion_reason` and never costs an
LLM call. Stage 2 sends only the survivors to the LLM for the description score. This keeps a 500-row
dataset to roughly `prefilter_top_n + 1` LLM calls per run, not 500.

### Persisting agent output — Supabase, a separate datastore
`app/agents/service.py::PipelineService` is the orchestrator: it calls the agents in sequence and
writes their output to Supabase via `app/integrations/supabase/database.py`, following this call-flow
(handed off by the teammate who built the Supabase schema — treated as a fixed contract):

```
Agent 1 (Product)  → save_product()  + create_run()
Agent 2 (Fit)       → save_prospect()   — one call per company that reached Stage 2 (eligible=True)
Agent 3 (Outreach)   → save_outreach() + update_outreach_status()
Dashboard             → get_products() → get_runs_for_product() → get_prospects_for_run()
                          → get_outreach_for_prospect()
```

This is deliberately a *different* database from `app/db/` (this app's own Postgres/SQLite, which owns
auth/workspaces/onboarding) — see "Persistence: hybrid, two datastores" in
`00-assumptions-and-decisions.md` for why. `backend/app/api/v1/routes/pipeline.py` exposes this over
HTTP: `POST /api/v1/pipeline/discover` runs Agent 1 + Agent 2, `POST
/api/v1/pipeline/prospects/{id}/draft-outreach` runs Agent 3 for one prospect, and the `GET` routes
back the dashboard reads above. Every route takes `use_real_agents` (default `false`, i.e. mock) as a
query param.

### What Agent 3 deliberately does NOT do here
The vendored `outreach_agent.run_outreach_agent()` blocks on `input("...approve sending? (y/n): ")` and
sends live SMTP mail itself — both wrong for a web backend. `RealOutreachAgent` reuses only the agent's
drafting chain and stops at a draft; `PipelineService.approve_outreach` / `.mark_sent` are the backend's
own explicit two-step approve-then-send, matching the brief's requirement that outreach always goes
through a human approval gate before anything sends. `.mark_sent` itself *does* actually send — via
`app/integrations/email/smtp_sender.py`, a small standalone SMTP client the backend owns (not the
agent's stripped-out path) — then records "sent" or "failed" based on what really happened. See
`vendor/CHANGES.md` for the full reasoning.
