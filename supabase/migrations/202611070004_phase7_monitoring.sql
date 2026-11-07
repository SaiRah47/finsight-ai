-- Phase 7 — secure owner-only daily monitoring. Run once in Supabase SQL Editor.
create table if not exists public.monitor_settings(
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 email_enabled boolean not null default false,
 filings_enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.monitor_runs(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 run_day date not null,
 status text not null default 'running' check(status in('running','completed','partial','failed')),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 symbols_scanned integer not null default 0,
 events_created integer not null default 0,
 error_text text,
 unique(user_id,run_day)
);
create table if not exists public.monitor_events(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid references public.monitor_runs(id) on delete set null,
 event_key text not null check(char_length(event_key) between 5 and 180),
 kind text not null check(kind in ('threshold','filing')),
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 title text not null check(char_length(title) between 1 and 200),
 details text not null default '' check(char_length(details)<=1400),
 source_url text,
 observation_at text,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 email_status text not null default 'not_requested' check(email_status in ('not_requested','pending','delivered','failed')),
 email_error text,
 unique(user_id,event_key)
);
create index if not exists monitor_events_user_date_idx on public.monitor_events(user_id,created_at desc);
create index if not exists monitor_runs_user_date_idx on public.monitor_runs(user_id,run_day desc);
create table if not exists public.monitor_rule_state(
 user_id uuid not null references auth.users(id) on delete cascade,
 rule_id uuid not null references public.watchlist_alert_rules(id) on delete cascade,
 triggered boolean not null default false,
 last_observation text,
 updated_at timestamptz not null default now(),
 primary key(user_id,rule_id)
);
-- SEC last-seen state prevents repeated alerts on older filing accessions.
create table if not exists public.monitor_filing_state(
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 last_accession text not null,
 updated_at timestamptz not null default now(),
 primary key(user_id,symbol)
);
alter table public.monitor_settings enable row level security;
alter table public.monitor_runs enable row level security;
alter table public.monitor_events enable row level security;
alter table public.monitor_rule_state enable row level security;
alter table public.monitor_filing_state enable row level security;
drop policy if exists "monitor owner settings" on public.monitor_settings;
drop policy if exists "monitor owner runs" on public.monitor_runs;
drop policy if exists "monitor owner events" on public.monitor_events;
drop policy if exists "monitor owner rule state" on public.monitor_rule_state;
drop policy if exists "monitor owner filing state" on public.monitor_filing_state;
create policy "monitor owner settings" on public.monitor_settings for select to authenticated using(user_id=(select auth.uid()));
create policy "monitor owner settings write" on public.monitor_settings for insert to authenticated with check(user_id=(select auth.uid()));
create policy "monitor owner settings update" on public.monitor_settings for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "monitor owner runs" on public.monitor_runs for select to authenticated using(user_id=(select auth.uid()));
create policy "monitor owner events" on public.monitor_events for select to authenticated using(user_id=(select auth.uid()));
create policy "monitor owner events update" on public.monitor_events for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "monitor owner rule state" on public.monitor_rule_state for select to authenticated using(user_id=(select auth.uid()));
create policy "monitor owner filing state" on public.monitor_filing_state for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.monitor_settings,public.monitor_runs,public.monitor_events,public.monitor_rule_state,public.monitor_filing_state from anon;
grant select,insert,update on public.monitor_settings to authenticated;
grant select on public.monitor_runs,public.monitor_rule_state,public.monitor_filing_state to authenticated;
grant select,update on public.monitor_events to authenticated;
-- Restrict owner event updates to read_at only at the API layer; authenticated clients already
-- have RLS owner scoping, but use column-level grants to prevent altering event payloads.
revoke update on public.monitor_events from authenticated;
grant update(read_at) on public.monitor_events to authenticated;
