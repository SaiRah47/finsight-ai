-- Phase 8 Agent Operations Studio: owner-only, read-only research and debate audits.
-- The study cannot modify paper account cash, positions, strategy versions, or orders.
create table if not exists public.arena_orchestration_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 status text not null check(status in ('complete','partial')),
 research_mode text not null check(research_mode in ('ai-assisted','deterministic')),
 verdict text not null check(verdict in ('consider','hold','abstain')),
 evidence jsonb not null default '[]'::jsonb,
 steps jsonb not null default '[]'::jsonb,
 debate jsonb not null default '[]'::jsonb,
 guardrails jsonb not null default '{}'::jsonb,
 limitations text[] not null default '{}',
 elapsed_ms integer not null check(elapsed_ms between 0 and 180000),
 created_at timestamptz not null default now()
);
create index if not exists arena_orchestration_owner_recent
 on public.arena_orchestration_runs (user_id,created_at desc);
alter table public.arena_orchestration_runs enable row level security;
drop policy if exists "arena orchestration owner view" on public.arena_orchestration_runs;
create policy "arena orchestration owner view" on public.arena_orchestration_runs
 for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.arena_orchestration_runs from anon, authenticated;
grant select on public.arena_orchestration_runs to authenticated;
-- Writes are performed only by owner-authenticated server code using Supabase secret.
