# Changes made to vendored agent code

The code under `agent1_product/`, `agent2_qualification/` and
`agent3_outreach/` is copied from `ghadahHameed/silah-multi-agent-SDA`
(branches `agent-1`, `agent-2`, `agent-3`). It is kept as close to the
original as possible; every deviation is listed here so it's never confused
with the authors' own code.

## Not copied

- `agent2_qualification/demo_agent2_run.py` -- an interactive CLI
  (`input()`-driven) for manually exercising Agent 2. Not needed by the
  backend, which calls `scoring.rank_prospects` directly (see
  `app/agents/adapters/real_fit.py`).
- `agent2_qualification/diagnose_embeddings.py` -- a standalone diagnostic
  script, not part of the scoring pipeline.
- `agent2_qualification/test_agent2_scoring.py`, `agent1_product/test_agent.py`,
  `agent3_outreach/test_outreach.py` -- the authors' own test suites, kept
  out of the shipped package (not needed at runtime; ask if you want these
  restored under the backend's own test setup instead).
- `agent2_qualification/Silah_Project_Overview.pdf`,
  `agent2_qualification/system_architacture.pdf` -- reference documents, not
  code.

## Import structure

Each agent's files assumed being the only files in a flat directory (e.g.
`from scoring import ...`). Nested as a proper Python package under
`app/agents/vendor/<agent>/`, those became relative imports:

- `agent2_qualification/qualification_agent.py`:
  `from prospect_loader import load_prospects` ->
  `from .prospect_loader import load_prospects`;
  `from scoring import ...` -> `from .scoring import ...`
- `agent2_qualification/scoring.py`:
  `from industry_lookup import ...` -> `from .industry_lookup import ...`;
  `from scoring_config import ...` -> `from .scoring_config import ...`
- `agent2_qualification/industry_lookup.py`:
  `from scoring_config import ...` -> `from .scoring_config import ...`

`agent1_product/product_agent.py` and `agent3_outreach/outreach_agent.py`
needed no import changes (no sibling-file imports).

## Behavioural changes

1. **`agent2_qualification/scoring.py`, `_get_openai_client()`** -- added
   optional `SILAH_OPENAI_BASE_URL` env var support. The original always
   used OpenAI's default base URL; unset/blank keeps that behaviour
   unchanged. This lets the same code run against an OpenAI-compatible
   proxy without touching vendor code again.

2. **`agent3_outreach/outreach_agent.py`, `llm = ChatOpenAI(...)`** -- the
   original hardcoded `model="gpt-5.6-luna"` with no api_key/base_url
   arguments (relying on langchain's default `OPENAI_API_KEY` env lookup and
   OpenAI's default endpoint). `"gpt-5.6-luna"` is not a public OpenAI model
   name, so as originally written this only works against whichever custom
   endpoint the author had configured locally -- a real inconsistency
   with agent1, which already parameterizes this via `LLM_MODEL` /
   `LLM_API_KEY` / `LLM_BASE_URL`. Made agent3 follow the same pattern, with
   the original hardcoded model name kept as the default so nothing changes
   unless those env vars are set.

3. **`agent3_outreach/outreach_agent.py`, same `ChatOpenAI(...)` call** --
   the original also always passed `model_kwargs={"reasoning_effort":
   "none"}`. `reasoning_effort` is only accepted by OpenAI's reasoning-model
   family (o1/o3/gpt-5, etc.); sent to a normal chat model (e.g.
   `LLM_MODEL=gpt-4o-mini`) the OpenAI API rejects the entire request with
   `400 Unrecognized request argument supplied: reasoning_effort`, which
   surfaced as a real crash once `LLM_MODEL` was pointed at a standard
   model. Made it opt-in via `LLM_REASONING_EFFORT` -- unset (the default)
   sends no `reasoning_effort` at all, so it works against any normal model;
   set it only if `LLM_MODEL` is actually a reasoning model that supports
   that parameter.

## Adapter-level design decisions (not edits to vendor code)

- **`app/agents/adapters/real_fit.py`** calls `scoring.rank_prospects(...)`
  directly, not `qualification_agent.qualify_prospects(...)`, because the
  latter insists on loading `silah_data.csv` from disk. The backend has its
  own company records (from our database / Supabase), so the adapter
  converts those to the exact dict shape Agent 2 expects
  (`_to_vendor_company`) and calls the scoring function directly. The
  adapter reads `evaluation_log` (every company, every stage) rather than
  `rank_prospects`'s own return value (`build_handoff` dicts, which only
  cover the selected top-N and drop `company_id`), so RankedCompany can
  report on excluded companies too, with the real gate that cut them.

- **`app/agents/adapters/real_outreach.py`** does NOT call
  `outreach_agent.run_outreach_agent()`. That function contains a blocking
  `input("Do you approve sending this email? (y/n): ")` call and live SMTP
  sending -- both incompatible with a web backend (an HTTP request thread
  cannot block on terminal input) and a bypass of this app's own separate
  approve-then-send workflow (a human reviews and approves a draft as an
  explicit backend action; sending is a separate step). The adapter reuses
  `outreach_agent.chain` (the `prompt | llm_with_tools` pipeline) to draft
  the email and extracts the `send_email_tool` call's `subject`/`body`
  arguments, but stops there -- no `input()`, no SMTP. The draft is handed
  back with `status="drafted"` (or `"needs_review"` when the company has no
  email on file, or the LLM didn't produce a tool call), and approval/send
  is owned entirely by the backend's own endpoints. Approval
  (`PipelineService.approve_outreach`) only flips a status; actually
  sending (`PipelineService.mark_sent`) uses a small standalone SMTP client
  the backend owns, `app/integrations/email/smtp_sender.py` -- a fresh,
  minimal reimplementation, not vendored code -- rather than the vendor's
  own `send_actual_email` (which is hardcoded to Gmail with no
  configurability and was never called from a non-blocking path anyway).

## Required environment variables

| Variable | Used by | Notes |
|---|---|---|
| `LLM_MODEL` | agent1, agent3 | model name for the ICP / outreach LLM calls |
| `LLM_API_KEY` | agent1, agent3 | falls back to `OPENAI_API_KEY` if unset (langchain default) |
| `LLM_BASE_URL` | agent1, agent3 | optional; unset uses OpenAI's default endpoint |
| `LLM_REASONING_EFFORT` | agent3 | optional; only set this if `LLM_MODEL` is a reasoning model (o1/o3/gpt-5, etc.) that supports it -- unset sends no `reasoning_effort` at all, which is correct for normal chat models like `gpt-4o-mini` |
| `SILAH_OPENAI_API_KEY` | agent2 | required for Stage 2 LLM scoring; agent2 uses the raw `openai` SDK, not langchain, so it does not read `OPENAI_API_KEY` |
| `SILAH_OPENAI_BASE_URL` | agent2 | optional; unset uses OpenAI's default endpoint (this repo's addition, see above) |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | `smtp_sender.py` (not an agent) | required for `PipelineService.mark_sent` to actually send; Gmail needs an App Password, not the login password |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USE_TLS` | `smtp_sender.py` | optional; default to Gmail's SMTP relay on port 587 with STARTTLS |
