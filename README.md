# Silah | صلة

Bilingual (AR/EN) B2B multi-agent outbound growth platform.

## Stack
- Frontend: Next.js (TypeScript) + Tailwind CSS -- see `frontend/README.md` for what's built
- Backend: FastAPI (Python) + PostgreSQL + Alembic
- Local dev: Docker Compose (`/infra`)

## Getting started

### Quick local test (SQLite, no Docker)

The fastest way to see both pieces running. No Postgres, no Docker --
SQLite is built into Python, so this only needs a venv and `pip install`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.sqlite.example .env
python scripts/init_sqlite_db.py    # creates silah_dev.db + seeds the demo account
uvicorn app.main:app --reload --reload-dir app      # http://localhost:8000/api/v1/health
```

`--reload-dir app` matters: without it, uvicorn watches the entire backend
folder for changes, including `.venv` -- since a venv has thousands of
installed files, this causes spurious reloads/restarts (you may see this
as `WatchFiles detected changes in '.venv\...'` in the logs, followed by an
unwanted restart). Scoping the watch to `app/` fixes it.

In a second terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                          # http://localhost:3000
```

Sign in with `demo@silah.sa` / `Demo123!` -- `init_sqlite_db.py` seeds this
exact account, so it's a real login now, not a local-only check. The
frontend calls the backend for real for auth and onboarding:
register/login hit `/api/v1/auth/*`, and the onboarding wizard's final
step persists your company and profile info via
`POST /api/v1/onboarding/complete`. Everything else (products, prospects,
dashboard KPIs) still runs on local mock data until Phase 2 -- see
`docs/03-implementation-plan.md`.

This path bypasses Alembic entirely (`init_sqlite_db.py` creates tables
straight from the models) -- it's for quick testing only. Schema changes
still go through Alembic migrations for the real Postgres deployment below.
If you already had a `silah_dev.db` from before this change, delete it and
rerun the init script -- `create_all()` adds missing tables, not missing
columns on ones that already exist, so an old file won't have the new
profile columns.

To confirm the backend works end to end on its own, once it's running:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"workspace_name":"Test Co","name":"Test User","email":"test@example.com","password":"testpass123"}'
# -> returns an access_token

curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <paste the access_token here>"
# -> returns the user + workspace profile
```

### Full setup (PostgreSQL, Docker)

```bash
cp backend/.env.example backend/.env
docker compose -f infra/docker-compose.yml up --build postgres backend
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

(Running the backend against Postgres without Docker? `pip install -r
requirements.txt -r requirements-postgres.txt` -- the Postgres driver lives
in that second file so the SQLite path above never has to build it.)

**Frontend** (run separately -- see `frontend/README.md` for demo credentials
and what's implemented vs. stubbed):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Or bring up everything together: `docker compose -f infra/docker-compose.yml up --build`

## Agent pipeline (Product / Fit / Outreach agents + Supabase)

The three agents (vendored from `ghadahHameed/silah-multi-agent-SDA` into
`backend/app/agents/vendor/`) and their Supabase persistence layer
(`backend/app/integrations/supabase/database.py`) are optional on top of
the base setup above -- the SQLite quick-test path and Docker/Postgres path
both work with none of this configured; every pipeline endpoint defaults to
the mock agents (`use_real_agents=false`) and nothing writes to Supabase
until a route that needs it is actually called.

To use the real agents and persist their output:

```bash
cd backend
pip install -r requirements.txt -r requirements-agents.txt -r requirements-supabase.txt
```

**Supabase setup** (one-time, per project):
1. Create a free project at supabase.com.
2. In the SQL Editor, paste and run `infra/supabase_schema.sql` -- it
   creates the exact `products`/`runs`/`prospects`/`outreach` tables
   `database.py` expects (this is the canonical DDL; `docs/02-database-schema.md`
   only covers the separate auth/workspace database).
3. Project Settings -> API keys -> copy the **service role** secret, not
   the anon/public key -- the backend is the only thing that talks to
   Supabase, so it should bypass Row Level Security rather than need
   policies written for it.

Then add to `backend/.env` (see the block already appended to
`.env.example` / `.env.sqlite.example`):

```
SUPABASE_URL=<your Supabase project URL>
SUPABASE_KEY=<the service-role key from step 3 above>
LLM_MODEL=<model name for Agent 1 + Agent 3, e.g. gpt-4o-mini>
LLM_API_KEY=<OpenAI-compatible API key>
LLM_BASE_URL=            # optional, only if not using OpenAI directly
SILAH_OPENAI_API_KEY=<API key for Agent 2 -- separate from LLM_API_KEY; agent2 uses the raw openai SDK, not langchain>
SILAH_OPENAI_BASE_URL=   # optional
```

Never commit real values for any of these -- `.env` is gitignored. See
`app/agents/vendor/CHANGES.md` for exactly why each variable exists and
what (if anything) was changed in the vendored code to support it.

**From the UI**: once those env vars are set and the backend is restarted,
open the "Add a new product" page and check "Use real AI agents" before
submitting -- same checkbox appears next to "Draft outreach" on the
results page and the prospect detail page. Leave it unchecked to keep
using the free mock agents.

**From curl**, call the pipeline with `?use_real_agents=true`:
```bash
curl -X POST "http://localhost:8000/api/v1/pipeline/discover?use_real_agents=true" \
  -H "Authorization: Bearer <token from /auth/login>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_name": "Cybersecurity Awareness Platform",
    "product_description": "A SaaS platform that trains employees to recognize phishing and social engineering.",
    "sender_name": "Nouf", "sender_company_name": "Silah", "sender_email": "nouf@silah.sa", "sender_phone": "+966500000000",
    "preferred_city": "Riyadh", "requested_company_count": 5
  }'
```
This runs Agent 1 then Agent 2 and saves the product/run/prospects to
Supabase. Without `companies` in the request body it scores against Agent
2's bundled 500-row reference dataset
(`backend/app/agents/vendor/agent2_qualification/silah_data.csv`); pass
your own `"companies": [...]` to score a different set. See
`docs/01-architecture.md` ("Agent integration contract") for the full
endpoint list and the two-stage scoring pipeline this runs through.

### Actually sending outreach (SMTP)

Drafting and approving outreach work with no configuration. **Sending**
(`POST /outreach/{id}/send`, the "Send" button in the UI) needs SMTP
credentials — without them it fails with a clear 503 rather than silently
pretending to have sent anything.

Add to `backend/.env`:
```
SMTP_USERNAME=<the mailbox you're sending from, e.g. you@gmail.com>
SMTP_PASSWORD=<an App Password -- see below, NOT your normal login password>
# SMTP_HOST=smtp.gmail.com   # default; only set if not using Gmail
# SMTP_PORT=587              # default
```

For Gmail specifically: turn on 2-Step Verification on the account, then
generate an App Password at
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
and use that as `SMTP_PASSWORD` — Gmail rejects the account's normal
password over SMTP. Any other SMTP-compatible provider works too, via
`SMTP_HOST`/`SMTP_PORT`.

A send that fails (bad recipient, SMTP rejection, network error) is
recorded as outreach status `failed` with the reason, not silently
swallowed — visible on the Prospect Detail page.

## Testing

Two test files under `backend/tests/`:

- **`test_pipeline_offline.py`** — needs only `pydantic` (no `fastapi`/
  `sqlalchemy`/`langchain`/`supabase`). Covers the agent schemas, the mock
  adapters, `PipelineService`'s full orchestration logic against an
  in-memory fake of the Supabase functions (including a run against the
  real bundled 500-row company dataset), and the Supabase status-validation
  contract. Run: `python -m unittest tests.test_pipeline_offline -v`
  (from `backend/`).
- **`test_api_e2e.py`** — the real FastAPI app (`app.main.app`) driven over
  real HTTP via `TestClient`, against a throwaway SQLite file: register →
  login → me → onboarding, then the full `/api/v1/pipeline/*` flow
  (discover → draft-outreach → approve → send) with the mock agents, so no
  LLM keys are needed to run it. Needs `requirements.txt` installed. Run:
  `python -m pytest tests/test_api_e2e.py -v` or
  `python -m unittest tests.test_api_e2e -v` (from `backend/`).

Run `test_pipeline_offline.py` first if you only want a fast sanity check;
run `test_api_e2e.py` to confirm the whole HTTP stack (the part that
actually matters end to end) works on your machine.

## Troubleshooting

**`AttributeError: module 'bcrypt' has no attribute '__about__'` / `ValueError: password cannot be longer than 72 bytes`
on *any* password** -- this was `passlib` (unmaintained since 2020)
breaking against `bcrypt>=4.1`. Fixed by dropping `passlib` and calling
`bcrypt.hashpw`/`bcrypt.checkpw` directly (`app/core/security.py`). If you
still hit this, you're running an older copy of this repo -- pull the
current `backend/app/core/security.py` and `backend/requirements.txt`
(no more `passlib[bcrypt]`), then `pip install -r requirements.txt` again
and re-run.

**`sqlite3.OperationalError: no such column: users.job_title`** (or any
other "no such column" on `users`/`workspaces`) -- your `silah_dev.db`
predates a profile-fields migration. `init_sqlite_db.py`'s `create_all()`
only creates missing *tables*, never adds missing *columns* to a table that
already exists. Fix: delete the file and reseed.
```bash
cd backend
rm silah_dev.db      # PowerShell: Remove-Item silah_dev.db
python scripts/init_sqlite_db.py
```

## Repo layout
- `/frontend` — Next.js app (landing/login, onboarding, dashboard, products,
  product detail, results, prospects, messages, all built against the real
  backend -- see `frontend/README.md`)
- `/backend` — FastAPI service: auth/workspace (Phase 1) + the agent
  pipeline (Product/Fit/Outreach agents, Supabase persistence)
- `/docs` — architecture, DB schema, implementation plan, screen map
- `/infra` — Docker Compose for local development + `supabase_schema.sql`
  (the DDL for the agent-pipeline tables)

## Status
Backend: Phase 1 (Foundation) -- auth (register/login/me), workspace + user
schema with onboarding profile fields, migrations -- plus the agent
pipeline described above: the three real agents are vendored and wrapped
in adapters (`app/agents/adapters/real_*.py`), an orchestrator
(`app/agents/service.py`) runs them end to end, and
`api/v1/routes/pipeline.py` exposes it over HTTP with Supabase persistence.
Mock adapters remain the default everywhere so nothing requires LLM
credentials just to run the app. 22 offline unit tests pass
(`tests/test_pipeline_offline.py`); a full HTTP end-to-end suite
(`tests/test_api_e2e.py`) is written and ready to run once `requirements.txt`
is installed on a machine with real network access.

Frontend: landing/login/signup/onboarding/dashboard/products/product-detail/
results/prospects/messages are all wired to the real `/api/v1/pipeline/*`
and auth endpoints -- no mock data left in any of them. Dashboard KPIs,
the conversion funnel, and the campaign chart are computed live from real
products/prospects/outreach records. The Analytics page was removed (it was
only a "coming soon" stub with no real data behind it) -- see "Known gaps"
below if it's wanted back later.
i18n keys for every page above have full English/Arabic parity
(`lib/i18n/en.json` / `ar.json`).

### Known gaps / next steps
- **Not yet on GitHub.** This repo has been iterated on locally and handed
  over as a zip each round. To switch to the repo-based, docs-in-repo
  workflow, connect a GitHub account so a repo can be created and pushed
  to; after that, docs updates and PRs replace zip handoffs.
- **Pipeline data isn't workspace-scoped.** Supabase products/runs/
  prospects/outreach are shared across the whole Supabase project, not
  scoped per Silah workspace like the auth database is (flagged in
  `api/v1/routes/pipeline.py`). Fine for single-team use; needs a
  `workspace_id` column before multi-tenant use.
- **Real agents and Supabase are confirmed working end to end** against a
  live LLM and a live Supabase project (not just import-safety checks
  anymore) -- discover -> score -> draft -> approve -> send has been run
  for real. Two bugs found in that process are fixed: the real Fit agent
  was returning up to `LLM_PREFILTER_TOP_N` (20) companies regardless of
  the requested count (see `RealFitAgent._cap_to_top_n` in
  `real_fit.py`), and "Send" only recorded a status without actually
  emailing anything (now sends via `app/integrations/email/smtp_sender.py`
  -- see "Actually sending outreach" above for the required env vars).
- **"Use real AI agents" is now a single, shared, persisted choice**
  (`frontend/lib/hooks/useRealAgentsPreference.ts`, saved to the browser's
  `localStorage`). Previously the checkbox on the discover/new-product page,
  the results page, and the prospect-detail page were three separate pieces
  of state, each starting back at "off" -- so turning real agents on to
  discover companies did not carry over to drafting outreach on the next
  page, and a draft could silently come from the mock Outreach agent
  instead of the real one. It now stays on (or off) across the whole flow
  on a given device until explicitly changed.
- **Draft-outreach button's disabled state is now visible, not just a
  hover tooltip.** A prospect with no email on file always disabled the
  button (`!prospect.company_email` -- this was correct, by design: FR-09
  says contact data is never fabricated), but the *reason* only showed up
  as a title-attribute tooltip, easy to miss. The results table and the
  prospect-detail page now also show a small "no email on file" line next
  to the disabled button.
- **Real Agent 3 (Outreach) crashed against a normal LLM_MODEL** with
  `400 Unrecognized request argument supplied: reasoning_effort`. The
  vendored `outreach_agent.py` always sent `model_kwargs={"reasoning_effort":
  "none"}`, a parameter only OpenAI's reasoning-model family (o1/o3/gpt-5)
  accepts -- a normal chat model like `gpt-4o-mini` gets its whole request
  rejected. Made it opt-in via a new `LLM_REASONING_EFFORT` env var (unset
  by default, so nothing is sent unless you're actually using a reasoning
  model) -- see `app/agents/vendor/CHANGES.md`.
- **A failed "Send" was a dead end, with no visible reason.** A per-message
  send failure (bad SMTP auth, a network hiccup, etc.) correctly recorded
  `status="failed"` with a reason in the database, but the prospect-detail
  page had no UI branch for that status at all -- no retry button, and the
  reason was never shown (only surfaced when there was no drafted email
  content, which isn't the case after a failed send). Two fixes:
  `PipelineService.mark_sent` now accepts retrying directly from
  `status="failed"` (previously only `"approved"`, so a failed send could
  never be retried without re-approving from scratch -- see
  `app/agents/service.py`), and the prospect-detail page now shows the
  failure reason in a red banner plus a "Retry send" button when a draft's
  status is `"failed"`.
- **Stale pooled connections could crash a Supabase or real-LLM call
  outright**, with crashes like `httpx.ReadError: [WinError 10035] A
  non-blocking socket operation could not be completed immediately` or
  `httpx.LocalProtocolError: Invalid input ConnectionInputs.RECV_DATA in
  state ConnectionState.CLOSED`. Both happen when a pooled keep-alive
  connection gets silently closed between requests (common on a home
  Windows machine -- an idle timeout, a flaky Wi-Fi/VPN hop, antivirus
  HTTPS inspection) and the next reuse trips a low-level transport error
  that has nothing to do with the request itself. `get_client()` in
  `database.py` caches one Supabase client (and its connection pool) for
  the whole process lifetime, so this could hit any Supabase call, and the
  same class of error can hit Agent 1/Agent 3's LLM calls too. Added
  `app/core/resilience.py`: a small, dependency-free (stdlib + httpx only,
  by design -- see that file's docstring for why no new package was added)
  decorator that retries a call a few times with backoff ONLY on
  `httpx.TransportError` and its subclasses, never on a real
  application-level error. Wired into every Supabase call
  (`database.py`'s `_execute`) and Agent 1/Agent 3's LLM calls
  (`real_product.py`, `real_outreach.py`) -- Agent 2 already had its own
  retry via `tenacity` in the vendored scoring code.
- Analytics page: removed (was only a "coming soon" stub with no real data
  behind it, and not something this project wants going forward). Its nav
  entry and route are gone; revisit only if there's a real reason to chart
  outreach volume later.
- Suppression / do-not-contact controls: not built yet, and sending is now
  real (see `docs/00-assumptions-and-decisions.md`) -- needed before any
  real-volume sending.

See `docs/03-implementation-plan.md` for the original phase sequencing.
