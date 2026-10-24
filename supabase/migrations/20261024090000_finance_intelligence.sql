begin;
-- Suggestions and labels only: never update the imported source ledger.
create table public.finance_transaction_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_text text not null check (length(btrim(match_text)) between 2 and 120),
  match_type text not null check (match_type in ('수입','지출','이체')),
  match_method text not null default '' check (length(match_method) <= 80),
  target_type text not null check (target_type in ('수입','지출','이체')),
  target_category text not null check (length(btrim(target_category)) between 1 and 80),
  target_subcategory text not null check (length(btrim(target_subcategory)) between 1 and 80),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index finance_transaction_rules_owner on public.finance_transaction_rules(user_id, created_at);
create table public.finance_transaction_tags (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_key text not null check (length(transaction_key) between 4 and 160),
  event_tag text not null check (length(btrim(event_tag)) between 1 and 80),
  updated_at timestamptz not null default now(),
  primary key(user_id,transaction_key)
);
alter table public.finance_transaction_rules enable row level security;
alter table public.finance_transaction_tags enable row level security;
revoke all on public.finance_transaction_rules, public.finance_transaction_tags from public, anon, authenticated;
grant select, insert, delete on public.finance_transaction_rules to authenticated;
grant select, insert, update, delete on public.finance_transaction_tags to authenticated;
create policy finance_rules_owner on public.finance_transaction_rules for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy finance_tags_owner on public.finance_transaction_tags for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
commit;
