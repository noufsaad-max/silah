-- Silah agent-pipeline schema (Supabase / Postgres)
--
-- This is the SEPARATE datastore the agent pipeline writes to --
-- products -> runs -> prospects -> outreach -- distinct from the app's own
-- auth/workspace database (SQLite or Postgres via SQLAlchemy). It is read
-- and written only through backend/app/integrations/supabase/database.py.
-- Column names/types here match that file exactly -- if you ever change
-- one, change the other.
--
-- How to apply:
--   1. Create a project at https://supabase.com (free tier is fine).
--   2. Project Settings -> Data API -> copy the "Project URL" into
--      SUPABASE_URL in backend/.env.
--   3. Project Settings -> API keys -> copy the SERVICE ROLE secret (not
--      the anon/public key) into SUPABASE_KEY in backend/.env. The backend
--      is the only thing that talks to Supabase (never the browser), so
--      the service-role key is the right one -- it bypasses Row Level
--      Security, which is what this schema assumes (RLS is left disabled
--      below; nothing public ever queries these tables directly).
--   4. SQL Editor -> New query -> paste this whole file -> Run.

create extension if not exists pgcrypto;

create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  product_name         text not null,
  product_description  text not null,
  sender_name          text not null,
  sender_company_name  text not null,
  sender_email         text not null,
  sender_phone         text not null,
  created_at           timestamptz not null default now()
);

create table if not exists runs (
  id                       uuid primary key default gen_random_uuid(),
  product_id               uuid not null references products(id) on delete cascade,
  preferred_city           text,
  requested_company_count  int,
  created_at               timestamptz not null default now()
);
create index if not exists idx_runs_product on runs(product_id);

create table if not exists prospects (
  id                 uuid primary key default gen_random_uuid(),
  run_id             uuid not null references runs(id) on delete cascade,
  source_company_id  text not null,
  company_name       text not null,
  fit_score          numeric,
  match_level        text,
  reason             text,
  company_email      text,
  research_status    text not null default 'pending',
  created_at         timestamptz not null default now()
);
create index if not exists idx_prospects_run on prospects(run_id);

create table if not exists outreach (
  id             uuid primary key default gen_random_uuid(),
  prospect_id    uuid not null references prospects(id) on delete cascade,
  status         text not null default 'not_sent'
                 check (status in (
                   'not_sent', 'draft', 'approved', 'sent',
                   'failed', 'replied', 'not_interested', 'meeting_requested'
                 )),
  status_reason  text,
  email_subject  text,
  message        text,
  reply_status   text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_outreach_prospect on outreach(prospect_id);

-- Sanity check after running the above -- should list all four tables:
-- select table_name from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('products', 'runs', 'prospects', 'outreach');
