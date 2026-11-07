-- FinSight ATLAS Phase 5: private user-reviewed relevance and claim judgments.
-- Execute manually in Supabase SQL Editor before using the Review Evidence feature.
create table if not exists public.research_evaluations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('retrieval','claim')),
 verdict text not null check (verdict in ('supported','unsupported','uncertain')),
 symbol text check (symbol is null or symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$'),
 question text not null check (char_length(question) between 3 and 500),
 source_url text,
 accession text,
 excerpt text not null check (char_length(excerpt) between 1 and 1600),
 rank integer check (rank is null or rank between 1 and 5),
 created_at timestamptz not null default now()
);
create index if not exists research_evaluations_owner_created_idx on public.research_evaluations(user_id, created_at desc);
alter table public.research_evaluations enable row level security;
drop policy if exists "Read own research evaluations" on public.research_evaluations;
drop policy if exists "Insert own research evaluations" on public.research_evaluations;
drop policy if exists "Delete own research evaluations" on public.research_evaluations;
create policy "Read own research evaluations" on public.research_evaluations for select to authenticated
 using (user_id=(select auth.uid()));
create policy "Insert own research evaluations" on public.research_evaluations for insert to authenticated
 with check (user_id=(select auth.uid()));
create policy "Delete own research evaluations" on public.research_evaluations for delete to authenticated
 using (user_id=(select auth.uid()));
revoke all on public.research_evaluations from anon;
grant select, insert, delete on public.research_evaluations to authenticated;
