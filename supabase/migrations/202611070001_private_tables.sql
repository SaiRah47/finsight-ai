-- Run in the Supabase SQL Editor. Never expose a service-role key in the app.
create extension if not exists pgcrypto;
create table if not exists public.watchlist_symbols (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.\-]{0,11}$'),
 created_at timestamptz not null default now(),
 unique(user_id,symbol)
);
create table if not exists public.research_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 question text not null check(char_length(question) between 3 and 500),
 route text not null check(route in ('market','risk','filings')),
 answer text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.execution_traces (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null references public.research_runs(id) on delete cascade,
 events jsonb not null default '[]'::jsonb check(jsonb_typeof(events)='array'),
 created_at timestamptz not null default now()
);
create index if not exists watchlist_owner_idx on public.watchlist_symbols(user_id);
create index if not exists research_owner_created_idx on public.research_runs(user_id,created_at desc);
create index if not exists traces_owner_created_idx on public.execution_traces(user_id,created_at desc);
alter table public.watchlist_symbols enable row level security;
alter table public.research_runs enable row level security;
alter table public.execution_traces enable row level security;
revoke all on public.watchlist_symbols,public.research_runs,public.execution_traces from anon,authenticated;
grant select,insert,delete on public.watchlist_symbols to authenticated;
grant select,insert on public.research_runs,public.execution_traces to authenticated;
create policy "select own symbols" on public.watchlist_symbols for select to authenticated using((select auth.uid())=user_id);
create policy "insert own symbols" on public.watchlist_symbols for insert to authenticated with check((select auth.uid())=user_id);
create policy "delete own symbols" on public.watchlist_symbols for delete to authenticated using((select auth.uid())=user_id);
create policy "select own research" on public.research_runs for select to authenticated using((select auth.uid())=user_id);
create policy "insert own research" on public.research_runs for insert to authenticated with check((select auth.uid())=user_id);
create policy "select own traces" on public.execution_traces for select to authenticated using((select auth.uid())=user_id);
create policy "insert own traces" on public.execution_traces for insert to authenticated with check(
 (select auth.uid())=user_id and exists(select 1 from public.research_runs r where r.id=run_id and r.user_id=(select auth.uid()))
);