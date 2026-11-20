# 03 — Implementation Plan

Adapts the brief's six build phases (§13) to the actual split of work: you build the web pages, the
backend, and the integration layer; your friends deliver the three agents separately. Every phase below
is buildable on your side without waiting on them, because agent calls are mocked (`adapters/mock.py`)
until a real handoff happens — see `01-architecture.md`.

## Phase 1 — Foundation
**Fully yours, no agent dependency.**
- Monorepo scaffolding: `/frontend`, `/backend`, `/docs`, `/infra`, Docker Compose for local Postgres.
- FastAPI skeleton, Alembic set up, `workspaces` + `users` tables migrated.
- Auth (JWT, per decision in `00-assumptions-and-decisions.md`), workspace-scoped route guards.
- Next.js skeleton, Tailwind + shadcn/ui, `[locale]` routing, i18n scaffolding (ar.json/en.json),
  light/dark theme persistence.
- **Done when:** login and onboarding work correctly in both Arabic (RTL) and English (LTR).

## Phase 2 — Campaign input
**Fully yours, no agent dependency.**
- Campaign CRUD + form validation matching the field groups in brief §5 ("Campaign creation").
- CSV/XLSX upload, column mapping UI, `import_jobs` + row-level validation, error report download.
- `companies` table populated from imports; demo dataset seed command.
- **Done when:** valid and invalid sample files produce correct import results (acceptance scenario 11).

## Phase 3 — Intelligence
**Your code (orchestration, scoring math, schema validation) + mock agents until handoff.**
- `agents/interfaces.py` + `schemas.py` finalized — this is the contract your friends build against.
- `services/scoring.py`: deterministic Fit-score math (brief §7), fully testable without any agent.
- `services/icp.py` + `services/orchestrator.py` wired to `adapters/mock.py` first, so ranking and
  caching-by-campaign-version can be built and tested end-to-end before real agents exist.
- **Agent handoff checkpoint:** when Product/Fit agents arrive, validate their output against
  `agents/schemas.py` before swapping `mock.py` for the real adapter — nothing downstream should need
  to change.
- **Done when:** a seeded 300-row run produces stable, deterministic ranked results (acceptance
  scenario 12).

## Phase 4 — Prospect workflow
**Mostly yours; Outreach Agent still mocked.**
- Prospect detail screen: score breakdown, evidence, missing data, fit explanation.
- Contact CRUD, missing-email review, verification status (never fabricated — brief FR-09).
- Draft message versions, approval flow tied to a specific version (re-approval required on edit).
- **Done when:** a reviewer can correct data and approve a draft (acceptance scenario, build phase 4).

## Phase 5 — Outreach and analytics
**Yours; email sending is real (SMTP), not the agents' concern.**
- Real send via `app/integrations/email/smtp_sender.py` (plain SMTP, e.g. Gmail with an App Password),
  invoked by `PipelineService.mark_sent` after human approval; a webhook receiver stub for
  delivery/reply events is still open.
- Activity timeline, Overview dashboard (KPIs, funnel chart, review queue), search/filter/export.
- **Agent handoff checkpoint:** swap in the real Outreach Agent here if it wasn't ready in Phase 3/4.
- **Done when:** the full demo journey and event timeline work end to end in both languages.

## Phase 6 — Hardening
- Security tests: cross-workspace access denial (acceptance scenario 17), rate limits on
  sign-in/analysis/generation/send endpoints.
- Accessibility pass (WCAG 2.1 AA), performance pass (dashboard <2.5s, 300-row analysis <2min excluding
  third-party latency), observability (structured logs, agent run cost/latency, incident IDs).
- Deployment docs, environment example without secrets, seed command, demo credentials.
- **Done when:** the full verification checklist in the brief (§16) passes with no critical defects.

## Working with the agent handoff in practice
Whenever your friends deliver a new or updated agent:
1. Confirm its output matches the relevant schema in `agents/schemas.py` exactly (structure, types,
   required fields) — reject silently-wrong shapes rather than coercing them.
2. Point the adapter (`inprocess.py` or `http.py`) at it; leave `mock.py` in place for local dev/tests
   so the test suite never depends on their service being up.
3. Re-run the relevant acceptance scenarios (12, 13, 14) to confirm scoring/coverage/missing-data
   behavior still holds with real output.
