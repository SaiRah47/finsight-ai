-- Version-controlled shadow competitions. No automatic modification of Season 1's ledger.
create table if not exists public.arena_strategy_versions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 version integer not null check(version between 1 and 99),
 allocation numeric(6,4) not null check(allocation between 0.05 and 0.25),
 kind text not null check(kind in('baseline','candidate')),
 created_at timestamptz not null default now(),
 unique(agent_id,version)
);
create table if not exists public.arena_strategy_control(
 agent_id uuid primary key references public.arena_agents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 active_version_id uuid not null references public.arena_strategy_versions(id),
 previous_version_id uuid references public.arena_strategy_versions(id),
 updated_at timestamptz not null default now()
);
create table if not exists public.arena_shadow_experiments(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 baseline_version_id uuid not null references public.arena_strategy_versions(id),
 candidate_version_id uuid not null references public.arena_strategy_versions(id),
 baseline_cash numeric(20,4) not null default 5000 check(baseline_cash>=0),
 candidate_cash numeric(20,4) not null default 5000 check(candidate_cash>=0),
 baseline_positions jsonb not null default '{}'::jsonb,
 candidate_positions jsonb not null default '{}'::jsonb,
 cycle_counter integer not null default 0,
 status text not null default 'active' check(status in('active','promoted','retired')),
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 retirement_note text check(retirement_note is null or char_length(retirement_note) between 8 and 1000),
 check(baseline_version_id<>candidate_version_id)
);
-- Handles partial early installations of this new migration without losing existing experiment rows.
alter table public.arena_shadow_experiments add column if not exists retirement_note text;
create unique index if not exists arena_one_active_shadow_per_agent
 on public.arena_shadow_experiments(agent_id) where status='active';
create table if not exists public.arena_shadow_steps(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 experiment_id uuid not null references public.arena_shadow_experiments(id) on delete cascade,
 observation_day date not null,
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 reference_price numeric(20,6) not null check(reference_price>0),
 baseline_fill jsonb,
 candidate_fill jsonb,
 baseline_equity numeric(20,4) not null check(baseline_equity>=0),
 candidate_equity numeric(20,4) not null check(candidate_equity>=0),
 created_at timestamptz not null default now(),
 unique(experiment_id,observation_day)
);
create index if not exists arena_shadow_steps_experiment_day_idx on public.arena_shadow_steps(experiment_id,observation_day);
create table if not exists public.arena_strategy_changes(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 experiment_id uuid references public.arena_shadow_experiments(id),
 from_version_id uuid not null references public.arena_strategy_versions(id),
 to_version_id uuid not null references public.arena_strategy_versions(id),
 action text not null check(action in('promote','rollback')),
 note text not null check(char_length(note) between 8 and 1000),
 created_at timestamptz not null default now()
);
create index if not exists arena_strategy_changes_owner_date on public.arena_strategy_changes(user_id,created_at desc);
alter table public.arena_strategy_versions enable row level security;
alter table public.arena_strategy_control enable row level security;
alter table public.arena_shadow_experiments enable row level security;
alter table public.arena_shadow_steps enable row level security;
alter table public.arena_strategy_changes enable row level security;
drop policy if exists "arena version owner view" on public.arena_strategy_versions;
drop policy if exists "arena control owner view" on public.arena_strategy_control;
drop policy if exists "arena experiment owner view" on public.arena_shadow_experiments;
drop policy if exists "arena steps owner view" on public.arena_shadow_steps;
drop policy if exists "arena changes owner view" on public.arena_strategy_changes;
create policy "arena version owner view" on public.arena_strategy_versions for select to authenticated using(user_id=(select auth.uid()));
create policy "arena control owner view" on public.arena_strategy_control for select to authenticated using(user_id=(select auth.uid()));
create policy "arena experiment owner view" on public.arena_shadow_experiments for select to authenticated using(user_id=(select auth.uid()));
create policy "arena steps owner view" on public.arena_shadow_steps for select to authenticated using(user_id=(select auth.uid()));
create policy "arena changes owner view" on public.arena_strategy_changes for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.arena_strategy_versions,public.arena_strategy_control,public.arena_shadow_experiments,public.arena_shadow_steps,public.arena_strategy_changes from anon,authenticated;
grant select on public.arena_strategy_versions,public.arena_strategy_control,public.arena_shadow_experiments,public.arena_shadow_steps,public.arena_strategy_changes to authenticated;

-- Atomically apply both independent book fills and both marks for one source-dated paper session.
-- Explicit service_role guard. Reject an observation day repeated in the same experiment.
create or replace function public.arena_record_shadow_step(
 p_owner uuid,p_experiment uuid,p_day date,p_symbol text,p_reference numeric,
 p_base_cash numeric,p_candidate_cash numeric,p_base_positions jsonb,p_candidate_positions jsonb,
 p_base_fill jsonb,p_candidate_fill jsonb,p_base_equity numeric,p_candidate_equity numeric
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare x public.arena_shadow_experiments%rowtype; result uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Privileged role required'; end if;
 if p_symbol !~ '^[A-Z][A-Z0-9.-]{0,11}$' or p_reference<=0 or p_base_cash<0 or p_candidate_cash<0
   or p_base_equity<0 or p_candidate_equity<0 or p_day is null
   or jsonb_typeof(p_base_positions)<>'object' or jsonb_typeof(p_candidate_positions)<>'object'
 then raise exception 'Invalid shadow step'; end if;
 select * into x from public.arena_shadow_experiments
 where id=p_experiment and user_id=p_owner and status='active' for update;
 if not found then raise exception 'Experiment unavailable'; end if;
 select id into result from public.arena_shadow_steps where experiment_id=p_experiment and observation_day=p_day;
 if result is not null then return result; end if;
 insert into public.arena_shadow_steps(
  user_id,experiment_id,observation_day,symbol,reference_price,baseline_fill,candidate_fill,
  baseline_equity,candidate_equity
 ) values(p_owner,p_experiment,p_day,p_symbol,p_reference,p_base_fill,p_candidate_fill,p_base_equity,p_candidate_equity)
 returning id into result;
 update public.arena_shadow_experiments set baseline_cash=p_base_cash,
  candidate_cash=p_candidate_cash,baseline_positions=p_base_positions,
  candidate_positions=p_candidate_positions,cycle_counter=cycle_counter+1 where id=p_experiment;
 return result;
end $$;
revoke all on function public.arena_record_shadow_step(uuid,uuid,date,text,numeric,numeric,numeric,jsonb,jsonb,jsonb,jsonb,numeric,numeric) from public,anon,authenticated;
grant execute on function public.arena_record_shadow_step(uuid,uuid,date,text,numeric,numeric,numeric,jsonb,jsonb,jsonb,jsonb,numeric,numeric) to service_role;

-- Version transitions are atomic, owner-authorized server actions only. Never touch portfolio cash.
create or replace function public.arena_switch_strategy_version(
 p_owner uuid,p_experiment uuid,p_action text,p_note text,p_expected uuid,p_next uuid
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare e public.arena_shadow_experiments%rowtype;
 c public.arena_strategy_control%rowtype; mark_count integer; change_id uuid;
begin
 if auth.role()<>'service_role' then raise exception 'Privileged role required'; end if;
 if char_length(p_note) not between 8 and 1000 or p_action not in ('promote','rollback') then
  raise exception 'Invalid transition rationale'; end if;
 select * into e from public.arena_shadow_experiments
  where id=p_experiment and user_id=p_owner for update;
 if not found then raise exception 'Experiment unavailable'; end if;
 select * into c from public.arena_strategy_control
  where agent_id=e.agent_id and user_id=p_owner for update;
 if not found or c.active_version_id is distinct from p_expected then
  raise exception 'Active version changed; retry review'; end if;
 if p_action='promote' then
  if e.status<>'active' or p_expected<>e.baseline_version_id or p_next<>e.candidate_version_id then
   raise exception 'Invalid promotion state'; end if;
  select count(*) into mark_count from public.arena_shadow_steps
   where experiment_id=p_experiment;
  if mark_count<20 then raise exception 'At least 20 paired observations required'; end if;
  update public.arena_shadow_experiments set status='promoted',finished_at=now() where id=p_experiment;
 else
  if e.status<>'promoted' or p_expected<>e.candidate_version_id or p_next<>e.baseline_version_id
   or c.previous_version_id is distinct from e.baseline_version_id then
   raise exception 'Rollback only available for the latest promoted version'; end if;
  update public.arena_shadow_experiments set status='retired',finished_at=now() where id=p_experiment;
 end if;
 perform 1 from public.arena_strategy_versions
  where id=p_next and agent_id=e.agent_id and user_id=p_owner;
 if not found then raise exception 'Target version does not belong to the agent'; end if;
 update public.arena_strategy_control set active_version_id=p_next,
  previous_version_id=p_expected,updated_at=now()
  where agent_id=e.agent_id and user_id=p_owner;
 insert into public.arena_strategy_changes(user_id,agent_id,experiment_id,from_version_id,to_version_id,action,note)
  values(p_owner,e.agent_id,p_experiment,p_expected,p_next,p_action,p_note)
  returning id into change_id;
 return change_id;
end $$;
revoke all on function public.arena_switch_strategy_version(uuid,uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.arena_switch_strategy_version(uuid,uuid,text,text,uuid,uuid) to service_role;
