-- Phase 8 learning lab: immutable daily observations and review records.
-- New tables do not modify or reset existing paper accounts, orders, or strategies.
create table if not exists public.arena_equity_observations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.arena_seasons(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 observation_day date not null,
 equity numeric(20,4) not null check(equity>=0),
 cash numeric(20,4) not null check(cash>=0),
 holdings_value numeric(20,4) not null check(holdings_value>=0),
 position_count integer not null check(position_count>=0),
 source text not null default 'Twelve Data' check(char_length(source)<=80),
 captured_at timestamptz not null default now(),
 unique(agent_id,observation_day)
);
create index if not exists arena_equity_owner_agent_day on public.arena_equity_observations(user_id,agent_id,observation_day);
create table if not exists public.arena_learning_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 season_id uuid not null references public.arena_seasons(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 review_day date not null,
 verdict text not null check(verdict in('insufficient-data','needs-investigation','observation-only')),
 diagnostics jsonb not null default '{}'::jsonb,
 proposed_change jsonb not null default '{}'::jsonb,
 status text not null default 'research-only' check(status='research-only'),
 created_at timestamptz not null default now(),
 unique(agent_id,review_day)
);
alter table public.arena_equity_observations enable row level security;
alter table public.arena_learning_reviews enable row level security;
drop policy if exists "arena equity owner read" on public.arena_equity_observations;
drop policy if exists "arena reviews owner read" on public.arena_learning_reviews;
create policy "arena equity owner read" on public.arena_equity_observations for select to authenticated using(user_id=(select auth.uid()));
create policy "arena reviews owner read" on public.arena_learning_reviews for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.arena_equity_observations,public.arena_learning_reviews from anon,authenticated;
grant select on public.arena_equity_observations,public.arena_learning_reviews to authenticated;
-- Only the server-side privileged role writes daily snapshots and proposals.
