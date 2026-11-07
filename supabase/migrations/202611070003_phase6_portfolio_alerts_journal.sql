-- FinSight ATLAS Phase 6: owner-only manually maintained holdings, alert rules and investment notes.
create table if not exists public.portfolio_holdings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 shares numeric(24,8) not null check (shares > 0 and shares <= 100000000),
 cost_basis_per_share numeric(24,8) check (cost_basis_per_share is null or (cost_basis_per_share >= 0 and cost_basis_per_share <= 100000000)),
 notes text not null default '' check (char_length(notes)<=500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,symbol)
);
create table if not exists public.watchlist_alert_rules (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 metric text not null check (metric in ('price_above','price_below','daily_change_abs','volatility_above','volume_ratio_above')),
 threshold numeric(20,6) not null check (threshold > 0 and threshold < 100000000),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(user_id,symbol,metric)
);
create table if not exists public.investment_journal (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text check (symbol is null or symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 title text not null check (char_length(title) between 3 and 160),
 thesis text not null check (char_length(thesis) between 1 and 4000),
 status text not null default 'researching' check (status in ('researching','watching','invalidated','archived')),
 evidence_url text check (evidence_url is null or char_length(evidence_url)<=600),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists holdings_user_idx on public.portfolio_holdings(user_id);
create index if not exists alert_rules_user_idx on public.watchlist_alert_rules(user_id);
create index if not exists journal_user_created_idx on public.investment_journal(user_id,created_at desc);
alter table public.portfolio_holdings enable row level security;
alter table public.watchlist_alert_rules enable row level security;
alter table public.investment_journal enable row level security;
drop policy if exists "owner holdings" on public.portfolio_holdings;
drop policy if exists "owner alert rules" on public.watchlist_alert_rules;
drop policy if exists "owner investment notes" on public.investment_journal;
create policy "owner holdings" on public.portfolio_holdings for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "owner alert rules" on public.watchlist_alert_rules for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "owner investment notes" on public.investment_journal for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.portfolio_holdings,public.watchlist_alert_rules,public.investment_journal from anon;
grant select,insert,update,delete on public.portfolio_holdings,public.watchlist_alert_rules,public.investment_journal to authenticated;
