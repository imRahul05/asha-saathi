-- ASHA Saathi schema. Idempotent: safe to run again (pnpm db:migrate).
-- pg_trgm powers fuzzy name matching ("Sunita" ~ "Sunitha Devi"). Falls back to ILIKE if it cannot be created.
create extension if not exists pg_trgm;

create table if not exists ashas (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  phc_name      text not null,
  doctor_name   text,
  doctor_phone  text,
  language      text not null default 'hi' check (language in ('hi', 'kn', 'en')),
  created_at    timestamptz not null default now()
);

-- Demo visitors each get their own copy of the template ASHA, so nobody sees anyone else's data.
alter table ashas add column if not exists is_demo boolean not null default false;

create table if not exists beneficiaries (
  id          uuid primary key default gen_random_uuid(),
  asha_id     uuid not null references ashas(id) on delete cascade,
  name        text not null,
  aliases     text[] not null default '{}',
  village     text,
  phone       text,
  age         int check (age between 10 and 60),
  parity      int check (parity between 0 and 20),
  lmp         date,
  created_at  timestamptz not null default now()
);
create index if not exists beneficiaries_asha_idx on beneficiaries (asha_id);
create index if not exists beneficiaries_name_trgm on beneficiaries using gin (name gin_trgm_ops);

create table if not exists visits (
  id               uuid primary key default gen_random_uuid(),
  asha_id          uuid not null references ashas(id) on delete cascade,
  beneficiary_id   uuid not null references beneficiaries(id) on delete cascade,
  session_id       text,
  visited_at       timestamptz not null default now(),
  gestation_weeks  int,
  bp_sys           int,
  bp_dia           int,
  hb               numeric(4,1),
  symptoms         text[] not null default '{}',
  notes            text,
  risk_level       text not null check (risk_level in ('normal', 'watch', 'high', 'urgent')),
  risk_reasons     jsonb not null default '[]',
  rules_version    text not null
);
create index if not exists visits_beneficiary_idx on visits (beneficiary_id, visited_at desc);
create index if not exists visits_session_idx on visits (session_id, visited_at desc);
create index if not exists visits_asha_idx on visits (asha_id, visited_at desc);

-- Alerts are two-phase: a draft is created first; sending needs the confirm token and only works once.
create table if not exists alerts (
  id               uuid primary key default gen_random_uuid(),
  visit_id         uuid not null references visits(id) on delete cascade,
  to_name          text,
  to_phone         text,
  message          text not null,
  status           text not null check (status in ('draft', 'sent', 'failed')),
  confirm_token    text not null unique,
  provider         text,
  provider_id      text,
  error            text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  sent_at          timestamptz
);
create index if not exists alerts_visit_idx on alerts (visit_id);
-- Compact text for SMS (trial accounts reject long SMS). WhatsApp uses the full message.
alter table alerts add column if not exists sms_text text;

create table if not exists followups (
  id               uuid primary key default gen_random_uuid(),
  asha_id          uuid not null references ashas(id) on delete cascade,
  beneficiary_id   uuid not null references beneficiaries(id) on delete cascade,
  visit_id         uuid references visits(id) on delete set null,
  due_date         date not null,
  reason           text,
  status           text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  created_at       timestamptz not null default now()
);
create index if not exists followups_due_idx on followups (asha_id, status, due_date);

-- Usage guard: every agent start and demo sign-in is counted, so one visitor cannot burn the free Agora minutes.
create table if not exists agent_starts (
  id          bigserial primary key,
  kind        text not null default 'agent' check (kind in ('agent', 'demo')),
  asha_id     uuid,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists agent_starts_time_idx on agent_starts (created_at desc);
create index if not exists agent_starts_ip_idx on agent_starts (ip_hash, created_at desc);
create index if not exists agent_starts_asha_idx on agent_starts (asha_id, created_at desc);

-- Every turn and tool call. The dashboard timeline reads this.
create table if not exists events (
  id          bigserial primary key,
  session_id  text,
  asha_id     uuid,
  turn_id     text,
  type        text not null,
  name        text not null,
  input       jsonb,
  output      jsonb,
  ok          boolean not null,
  ms          int,
  created_at  timestamptz not null default now()
);
create index if not exists events_session_idx on events (session_id, id);
create index if not exists events_recent_idx on events (id desc);
