-- Phase 10.2: append-only point-in-time historical market observations.
-- No brokerage integration, executable orders, or real-money transaction support.
create table if not exists public.market_dataset_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.\\-]{0,11}$'),
 provider text not null check (provider = 'Twelve Data'),
 interval text not null check (interval = '1day'),
 period text not null check (period = '1Y'),
 first_date date,
 last_date date,
 observation_count integer not null check (observation_count between 1 and 500),
 dataset_sha256 text not null check (dataset_sha256 ~ '^[0-9a-f]{64}$'),
 quality jsonb not null,
 payload jsonb not null,
 source_fetched_at timestamptz not null,
 captured_at timestamptz not null default now(),
 unique (user_id,symbol,dataset_sha256),
 check (first_date is null or last_date is null or first_date <= last_date)
);
create index if not exists market_dataset_snapshots_owner_capture_idx
 on public.market_dataset_snapshots (user_id,captured_at desc);
create index if not exists market_dataset_snapshots_owner_symbol_idx
 on public.market_dataset_snapshots (user_id,symbol,captured_at desc);
alter table public.market_dataset_snapshots enable row level security;
revoke all on public.market_dataset_snapshots from anon;
revoke all on public.market_dataset_snapshots from authenticated;
grant select on public.market_dataset_snapshots to authenticated;
grant select,insert,update,delete on public.market_dataset_snapshots to service_role;
drop policy if exists "market snapshot owner select" on public.market_dataset_snapshots;
create policy "market snapshot owner select" on public.market_dataset_snapshots
 for select to authenticated using (user_id=(select auth.uid()));
-- Writes require the authenticated owner API plus server-only credentials.
-- Never update a snapshot's payload or re-price old datasets.
