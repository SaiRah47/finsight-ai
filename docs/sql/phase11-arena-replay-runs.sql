-- Phase 11 historical tournament. Strictly separate from Season 1 forward-paper ledger.
create table if not exists public.arena_replay_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 run_key text not null check (run_key ~ '^[0-9a-f]{64}$'),
 start_date date not null,
 end_date date not null,
 sessions integer not null check (sessions >= 60),
 symbols text[] not null,
 snapshot_ids uuid[] not null,
 result jsonb not null,
 created_at timestamptz not null default now(),
 unique (user_id,run_key),
 check (end_date >= start_date)
);
create index if not exists arena_replay_runs_owner_recent_idx
 on public.arena_replay_runs(user_id,created_at desc);
alter table public.arena_replay_runs enable row level security;
revoke all on public.arena_replay_runs from anon,authenticated;
grant select on public.arena_replay_runs to authenticated;
grant select,insert,update,delete on public.arena_replay_runs to service_role;
drop policy if exists "owner replay view" on public.arena_replay_runs;
create policy "owner replay view" on public.arena_replay_runs
 for select to authenticated using(user_id=(select auth.uid()));
-- No insert/update/delete client policy; API uses server-only credentials and owner check.
-- Simulation records never modify arena_agents, arena_orders, arena_positions, or external brokerage systems.
