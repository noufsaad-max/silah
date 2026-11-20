# 02 — Database Schema and Migrations

Translates the entity list in the brief (§8) into concrete PostgreSQL DDL. This is the first-pass
schema to author as the initial Alembic migration — expect to refine column choices once real import
data is seen, but the shape and the workspace-scoping pattern shouldn't change.

> **This is the auth/workspace database only** (`app/db/`, migrated via Alembic below). The
> agent-pipeline data — `products → runs → prospects → outreach`, written by the three agents and read
> by the dashboard — lives in a *separate* Supabase project instead, accessed only through
> `backend/app/integrations/supabase/database.py`. Its DDL is `infra/supabase_schema.sql` (paste-ready
> into the Supabase SQL editor), not this file. See "Persistence: hybrid, two datastores" in
> `00-assumptions-and-decisions.md` and the call-flow in `01-architecture.md`.

Every table that holds workspace data carries `workspace_id` (directly or via its parent), and every
query in the backend must filter by it — this is what "workspace isolation" (brief §10, acceptance
scenario 17) means in practice under auth option A.

## Enum types

```sql
CREATE TYPE workspace_role AS ENUM ('owner_admin', 'campaign_manager', 'sales_rep', 'reviewer');
CREATE TYPE user_status AS ENUM ('invited', 'active', 'disabled');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE import_status AS ENUM ('pending', 'validating', 'completed', 'failed');
CREATE TYPE analysis_status AS ENUM ('queued', 'processing', 'completed', 'failed');
CREATE TYPE fit_label AS ENUM ('high_fit', 'medium_fit', 'low_fit', 'not_fit');
CREATE TYPE contact_status AS ENUM ('complete', 'email_needed', 'needs_review', 'verified');
CREATE TYPE message_status AS ENUM ('draft', 'approved', 'scheduled', 'sent', 'delivered', 'bounced', 'replied');
CREATE TYPE prospect_outcome AS ENUM ('active', 'won', 'lost', 'archived');
CREATE TYPE agent_type AS ENUM ('product', 'fit', 'outreach');
CREATE TYPE agent_run_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
```

## Core tables

```sql
CREATE TABLE workspaces (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  locale               text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
  timezone             text NOT NULL DEFAULT 'UTC',
  theme                text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  data_retention_days  int NOT NULL DEFAULT 90,
  registration_mode    text NOT NULL DEFAULT 'invite' CHECK (registration_mode IN ('invite', 'open')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id),
  name           text NOT NULL,
  email          text NOT NULL UNIQUE,
  phone          text,
  role           workspace_role NOT NULL,
  status         user_status NOT NULL DEFAULT 'invited',
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_workspace ON users(workspace_id);

CREATE TABLE campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES workspaces(id),
  name                  text NOT NULL,
  product_name          text NOT NULL,
  product_description   text NOT NULL,
  problem_solved        text NOT NULL,
  website_or_brochure   text,
  value_proposition     text,
  differentiators       text,
  target_country        text NOT NULL,
  target_industry       text NOT NULL,
  target_company_type   text NOT NULL,
  target_cities         text[],
  revenue_range         text,
  employee_range        text,
  growth_signal_prefs   text,
  excluded_industries   text[],
  excluded_companies    text[],
  excluded_domains      text[],
  top_result_count      int NOT NULL DEFAULT 5,
  sender_identity        text,
  message_objective      text,
  tone                    text,
  language                text NOT NULL DEFAULT 'en',
  call_to_action          text,
  signature               text,
  status                  campaign_status NOT NULL DEFAULT 'draft',
  version                 int NOT NULL DEFAULT 1,
  created_by              uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);

CREATE TABLE import_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id),
  filename        text NOT NULL,
  storage_path    text NOT NULL,
  column_mapping  jsonb,
  total_rows      int,
  valid_rows      int,
  error_rows      int,
  errors          jsonb,
  status          import_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_jobs_campaign ON import_jobs(campaign_id);

CREATE TABLE companies (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES workspaces(id),
  name                   text NOT NULL,
  website_domain         text,
  industry               text,
  industry_raw           text,
  description            text,
  country                text NOT NULL,
  city                   text,
  annual_revenue         numeric,
  annual_revenue_currency text,
  employee_count         int CHECK (employee_count >= 0),
  growth_signals         jsonb,
  source_url             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, website_domain)
);
CREATE INDEX idx_companies_workspace ON companies(workspace_id);

CREATE TABLE campaign_companies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id        uuid NOT NULL REFERENCES campaigns(id),
  company_id         uuid NOT NULL REFERENCES companies(id),
  campaign_version   int NOT NULL,            -- ties this run to campaigns.version, for cache/rerun stability
  eligible           boolean NOT NULL DEFAULT true,
  exclusion_reason   text,
  total_score        numeric,                  -- normalized, null until scored
  coverage           numeric,                    -- percent of canonical weight backed by evidence
  rank               int,
  fit_label          fit_label,
  outcome            prospect_outcome NOT NULL DEFAULT 'active',
  explanation        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, company_id, campaign_version)
);
CREATE INDEX idx_campaign_companies_rank ON campaign_companies(campaign_id, campaign_version, rank);

CREATE TABLE score_factors (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_company_id    uuid NOT NULL REFERENCES campaign_companies(id),
  factor                 text NOT NULL CHECK (factor IN
                           ('industry_relevance', 'observable_need_signals', 'operational_fit', 'growth_signals')),
  raw_score              numeric CHECK (raw_score BETWEEN 0 AND 100),  -- null = no evidence, never guessed
  weight                 numeric NOT NULL,
  evidence               jsonb,
  missing_reason         text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_score_factors_campaign_company ON score_factors(campaign_company_id);

CREATE TABLE contacts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id),
  name                 text,
  title                text,
  email                text,
  phone                text,
  verification_status  contact_status NOT NULL DEFAULT 'email_needed',
  source               text,
  confidence           numeric,
  last_checked_at      timestamptz,
  created_by           uuid REFERENCES users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_company ON contacts(company_id);

CREATE TABLE messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_company_id   uuid NOT NULL REFERENCES campaign_companies(id),
  contact_id            uuid NOT NULL REFERENCES contacts(id),
  subject               text NOT NULL,
  body                  text NOT NULL,
  language              text NOT NULL,
  version               int NOT NULL DEFAULT 1,
  status                message_status NOT NULL DEFAULT 'draft',
  approved_by           uuid REFERENCES users(id),
  approved_at           timestamptz,
  sent_at               timestamptz,
  provider_message_id   text,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_campaign_company ON messages(campaign_company_id);

CREATE TABLE activity_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id),
  actor_user_id  uuid REFERENCES users(id),        -- null for system-generated events
  entity_type    text NOT NULL,
  entity_id      uuid NOT NULL,
  event_type     text NOT NULL,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_events_workspace ON activity_events(workspace_id, created_at DESC);
CREATE INDEX idx_activity_events_entity ON activity_events(entity_type, entity_id);

CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id),
  agent_type      agent_type NOT NULL,
  prompt_version  text,
  model_name      text,
  input           jsonb NOT NULL,
  output          jsonb,
  status          agent_run_status NOT NULL DEFAULT 'queued',
  duration_ms     int,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_runs_campaign ON agent_runs(campaign_id, agent_type);
```

## Notes on a few deliberate choices

- **`campaign_companies.campaign_version`** exists so a rerun never overwrites a prior run's scores —
  it directly backs acceptance scenario 12 ("same campaign produces the same ranking when rerun
  without changed inputs") and the brief's "do not silently retrain or change past scores" rule (§3
  step 9).
- **`score_factors.raw_score` is nullable**, not defaulted to 0 — this is what makes "missing values
  are not guessed and are not silently scored as zero" (brief §7) enforceable at the schema level, not
  just in application code.
- **`companies` is deduplicated per workspace by `website_domain`**, matching the brief's note that
  `company_name` + domain drive duplicate detection (§8 import schema).
- Alembic migrations should be additive and reversible from the start — Phase 1 creates
  `workspaces`/`users`/enums; each later phase adds its own tables, matching the build phases in
  `03-implementation-plan.md`.
