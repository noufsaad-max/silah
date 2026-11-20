# 00 — Assumptions and Open Decisions

This records every place the product brief (`Silah_Web_App_Product_and_Technical_Brief.docx`, §14) left a
choice open, plus the decisions confirmed in conversation. Anything marked **Open** needs your input
before we build against it — everything else is a working default we'll build on unless you say otherwise.

## Decided (confirmed by you)

**Backend: Python + FastAPI, not Next.js API routes.**
The brief's default MVP stack (§11) keeps everything inside one Next.js codebase using server
actions/API routes. You've chosen a two-service split instead: Next.js (frontend only) talking to a
separate FastAPI backend over REST/JSON. This is a meaningful deviation from the brief's default and
changes the architecture, deployment shape, and how the frontend/backend contract stays in sync — see
`01-architecture.md`.

**Frontend: React + Next.js + Tailwind CSS**, matching the brief's own recommendation, with shadcn/ui
(or an equivalent Tailwind-based primitive library) for accessible components.

**Your scope vs. your collaborators':** you own the web pages, the backend, and the integration layer.
Your friends own the three agents (Product, Fit, Outreach). The backend's job is therefore to expose a
stable contract those agents plug into, regardless of how they're implemented internally — see
"Agent integration" in `01-architecture.md`.

**Repo shape: monorepo.** `/frontend`, `/backend`, `/docs`, `/infra` in one repo, matching the structure
you pointed me to. Flag it if you'd rather split frontend and backend into separate repos.

**Agent integration transport: in-process Python.** Resolved by seeing the real agent code
(`ghadahHameed/silah-multi-agent-SDA`): all three agents are plain Python functions
(`analyze_product`, `scoring.rank_prospects`, the `outreach_agent.chain` pipeline), not separate
services. They're vendored into `backend/app/agents/vendor/` and wrapped by adapters
(`backend/app/agents/adapters/real_*.py`) that satisfy the same `ProductAgent`/`FitAgent`/
`OutreachAgent` interfaces the mock adapters already did — see `01-architecture.md` and
`app/agents/vendor/CHANGES.md` for exactly what was changed to make that vendoring work (import
fixes, and stripping Agent 3's blocking `input()`/SMTP-send code, which doesn't belong in a web
request handler).

**Persistence: hybrid, two datastores.** This app's own Postgres/SQLite database (SQLAlchemy,
`backend/app/db/`) continues to own auth, workspaces and onboarding, unchanged. A second, separate
datastore — Supabase, via `backend/app/integrations/supabase/database.py` — owns only the
agent-pipeline data: `products → runs → prospects → outreach`. That schema and the function
signatures (`save_product`, `create_run`, `save_prospect`, `save_outreach`,
`update_outreach_status`, `get_products`, `get_runs_for_product`, `get_prospects_for_run`,
`get_outreach_for_prospect`) were handed off by a teammate and are treated as a fixed contract, not
redesigned. Why two stores instead of merging into one: the agent-pipeline schema was already built
and populated in Supabase independently of this backend's own auth schema, and merging them would
mean either migrating that work or duplicating it — not worth it for an MVP where the two halves
(who's logged in vs. what a given outreach run found) don't actually need to be queried together in
one transaction. `SUPABASE_URL`/`SUPABASE_KEY` are read only from environment variables
(`app/core/config.py` → `.env`), never hardcoded — see `.env.example`.

## Recommended defaults (from brief §14, adopted unless you say otherwise)

| Decision | Default | Why it's still open |
|---|---|---|
| Database | PostgreSQL | — |
| Auth / authorization model | See "Open" below | Brief assumed Supabase Auth + RLS with the client talking to Supabase directly; a FastAPI backend in the middle changes that |
| Background jobs | DB-backed job table + worker process for MVP; Celery/Redis if load grows | No infra dependency for MVP; easy to swap later |
| Agent calls | Behind a provider-agnostic interface | Your friends may change model/provider without notice |
| Email sending | Simulated (demo mode) first; real provider behind an adapter | Sender domain/provider not chosen yet |
| Contact data | Manual entry + demo data first; no live enrichment provider | Adds cost/legal review later |
| File storage | Private object storage, signed URLs (S3-compatible; MinIO for local dev) | Actual provider (AWS vs. local) still open |
| Top-N ranked leads | 5, configurable per campaign | — |
| Data retention | 90 days for uploads, configurable per workspace | Org policy undefined |
| Registration | Invite-based by default, configurable | Deployment audience undecided |
| Scoring thresholds | High ≥80 (coverage ≥70), Medium 60–79, Low <60, else "Needs Review" | Needs validation with real campaigns |

## Open — needs a decision from you

### 1. Auth strategy
Because FastAPI sits between the browser and Postgres, Supabase's Auth+RLS model (built for direct
client access) doesn't map cleanly onto this shape. Two real options:

- **A — FastAPI-owned auth (recommended default):** plain PostgreSQL, FastAPI issues/verifies JWTs,
  workspace isolation enforced in every query at the service layer (with tests proving cross-workspace
  access fails, per acceptance scenario 17). One place owns authorization — simpler to reason about.
- **B — Supabase Auth + RLS, FastAPI uses the service-role key:** you get Supabase's hosted auth
  UI/flows for free, but FastAPI then has to re-apply workspace scoping on every query anyway (the
  service-role key bypasses RLS), so you partly lose the benefit RLS was meant to give, for the cost of
  running a second auth system.

Defaulting to **A** unless you specifically want Supabase's hosted auth UI or social login. Let me know.

### 2. ~~Agent integration transport~~ — Resolved: in-process Python (see "Decided" above).

### 3. Deployment targets
Brief doesn't specify hosting. A common pairing for this stack: Next.js on Vercel, FastAPI on
Render/Railway/Fly.io, Postgres managed (Supabase/Neon/RDS). Doesn't block early development — Docker
Compose covers local dev regardless of what we pick later.

## Data and ethics constraints carried over unchanged (brief §14)
- Use only business contact information from authorized sources.
- **Suppression / do-not-contact controls are not built yet, and outreach sending is real** (SMTP,
  `app/integrations/email/smtp_sender.py`, invoked by `PipelineService.mark_sent`) — this is an active
  gap, not a future hypothetical, before sending at any real volume.
- Keep source attribution and verification dates on every contact record.
- No discriminatory criteria or sensitive personal attributes in targeting or scoring.
- Saudi privacy / electronic-communications compliance must be confirmed before production launch —
  not before the MVP demo, but it's a hard gate before real sending goes live.
