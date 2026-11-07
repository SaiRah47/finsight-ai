-- Phase 8 Agent Arena: pure virtual capital, owner-only, no brokerage credentials.
create table if not exists public.arena_seasons(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null default 'Season 1' check(char_length(name) between 3 and 80),
 mode text not null default 'forward-paper' check(mode='forward-paper'),
 status text not null default 'active' check(status in ('active','closed')),
 starting_cash numeric(20,4) not null default 5000 check(starting_cash=5000),
 created_at timestamptz not null default now(),
 unique(user_id,name)
);
create table if not exists public.arena_agents(
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.arena_seasons(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 slug text not null check(slug in('ai-maximalist','ai-skeptic','mag7-purist','value-investor','momentum-trader','mean-reversion','opening-range')),
 league text not null check(league in('investor','trader')),
 status text not null default 'active' check(status in('active','paused')),
 cash numeric(20,4) not null default 5000 check(cash>=0),
 created_at timestamptz not null default now(),
 unique(season_id,slug)
);
create table if not exists public.arena_positions(
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 shares numeric(20,8) not null check(shares>=0),
 average_cost numeric(20,6) not null check(average_cost>=0),
 updated_at timestamptz not null default now(),
 primary key(agent_id,symbol)
);
create table if not exists public.arena_orders(
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 request_key text not null check(char_length(request_key) between 6 and 120),
 symbol text not null check(symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 side text not null check(side in('buy','sell')),
 shares numeric(20,8) not null check(shares>0),
 reference_price numeric(20,6) not null check(reference_price>0),
 fill_price numeric(20,6) not null check(fill_price>0),
 fee numeric(20,4) not null check(fee>=0),
 gross_value numeric(20,4) not null check(gross_value>=0),
 reason text not null check(char_length(reason) between 1 and 1800),
 signal_date text not null,
 source text not null default 'Twelve Data quote' check(char_length(source)<=100),
 created_at timestamptz not null default now(),
 unique(agent_id,request_key)
);
create table if not exists public.arena_decisions(
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.arena_seasons(id) on delete cascade,
 agent_id uuid not null references public.arena_agents(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 cycle_date date not null,
 symbol text not null,
 action text not null check(action in('buy','hold','reject')),
 reason text not null check(char_length(reason) between 1 and 1800),
 evidence text not null default '' check(char_length(evidence)<=1200),
 observed_at text,
 order_id uuid references public.arena_orders(id),
 created_at timestamptz not null default now(),
 unique(agent_id,cycle_date)
);
create index if not exists arena_orders_agent_date_idx on public.arena_orders(agent_id,created_at desc);
create index if not exists arena_decisions_user_date_idx on public.arena_decisions(user_id,created_at desc);
alter table public.arena_seasons enable row level security;
alter table public.arena_agents enable row level security;
alter table public.arena_positions enable row level security;
alter table public.arena_orders enable row level security;
alter table public.arena_decisions enable row level security;
drop policy if exists "arena seasons owner read" on public.arena_seasons;
drop policy if exists "arena agents owner read" on public.arena_agents;
drop policy if exists "arena positions owner read" on public.arena_positions;
drop policy if exists "arena orders owner read" on public.arena_orders;
drop policy if exists "arena decisions owner read" on public.arena_decisions;
create policy "arena seasons owner read" on public.arena_seasons for select to authenticated using(user_id=(select auth.uid()));
create policy "arena agents owner read" on public.arena_agents for select to authenticated using(user_id=(select auth.uid()));
create policy "arena positions owner read" on public.arena_positions for select to authenticated using(user_id=(select auth.uid()));
create policy "arena orders owner read" on public.arena_orders for select to authenticated using(user_id=(select auth.uid()));
create policy "arena decisions owner read" on public.arena_decisions for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.arena_seasons,public.arena_agents,public.arena_positions,public.arena_orders,public.arena_decisions from anon,authenticated;
grant select on public.arena_seasons,public.arena_agents,public.arena_positions,public.arena_orders,public.arena_decisions to authenticated;
-- Internal atomic virtual order fill. Invoked ONLY by privileged server client.
create or replace function public.arena_execute_virtual_order(
 p_agent uuid,p_owner uuid,p_request_key text,p_symbol text,p_side text,
 p_shares numeric,p_reference_price numeric,p_fill_price numeric,p_fee numeric,
 p_signal_date text,p_reason text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare a public.arena_agents%rowtype; pos public.arena_positions%rowtype;
  existing uuid; new_order uuid; gross numeric; total numeric;
begin
 if auth.role() <> 'service_role' then raise exception 'Privileged server role required'; end if;
 if p_request_key is null or char_length(p_request_key) not between 6 and 120
  or p_symbol !~ '^[A-Z][A-Z0-9.-]{0,11}$'
  or p_side not in ('buy','sell') or p_shares<=0 or p_shares>1000000
  or p_reference_price<=0 or p_fill_price<=0 or p_fee<0
  or p_signal_date is null or char_length(p_signal_date)>60
  or p_reason is null or char_length(p_reason) not between 1 and 1800
 then raise exception 'Invalid paper execution'; end if;
 select * into a from public.arena_agents where id=p_agent and user_id=p_owner for update;
 if not found or a.status<>'active' or a.league<>'investor' then raise exception 'Agent unavailable or trading league not enabled'; end if;
 perform 1 from public.arena_seasons where id=a.season_id and status='active';
 if not found then raise exception 'Season inactive'; end if;
 select id into existing from public.arena_orders where agent_id=p_agent and request_key=p_request_key;
 if existing is not null then return existing; end if;
 gross:=round(p_shares*p_fill_price,4);
 total:=gross+p_fee;
 select * into pos from public.arena_positions where agent_id=p_agent and symbol=p_symbol for update;
 if p_side='buy' then
  if a.cash<total then raise exception 'Insufficient virtual cash'; end if;
  update public.arena_agents set cash=round(cash-total,4) where id=p_agent;
  insert into public.arena_positions(agent_id,user_id,symbol,shares,average_cost)
   values(p_agent,p_owner,p_symbol,p_shares,round(total/p_shares,6))
   on conflict(agent_id,symbol) do update set
    average_cost=round((public.arena_positions.average_cost*public.arena_positions.shares+total)/
     (public.arena_positions.shares+p_shares),6),
    shares=public.arena_positions.shares+p_shares,updated_at=now();
 else
  if pos.agent_id is null or pos.shares<p_shares then raise exception 'Insufficient virtual shares'; end if;
  update public.arena_agents set cash=round(cash+gross-p_fee,4) where id=p_agent;
  update public.arena_positions set shares=shares-p_shares,updated_at=now() where agent_id=p_agent and symbol=p_symbol;
 end if;
 insert into public.arena_orders(agent_id,user_id,request_key,symbol,side,shares,reference_price,fill_price,fee,gross_value,signal_date,reason)
 values(p_agent,p_owner,p_request_key,p_symbol,p_side,p_shares,p_reference_price,p_fill_price,p_fee,gross,p_signal_date,p_reason)
 returning id into new_order;
 return new_order;
end $$;
revoke all on function public.arena_execute_virtual_order(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,text) from public,anon,authenticated;
grant execute on function public.arena_execute_virtual_order(uuid,uuid,text,text,text,numeric,numeric,numeric,numeric,text,text) to service_role;
