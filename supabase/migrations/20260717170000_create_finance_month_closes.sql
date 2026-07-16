-- Monthly CFO close records keep classification overrides separate from the
-- immutable transaction ledger. One row represents one payday accounting month.

create extension if not exists pgcrypto;

create table if not exists public.finance_month_closes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
    default coalesce(auth.uid(), public.netvisualizer_public_owner_id()),
  period_key text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  classifications jsonb not null default '{}'::jsonb
    check (jsonb_typeof(classifications) = 'object'),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  source_revision text not null default '',
  reviewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_month_closes_period_key_check
    check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint finance_month_closes_period_range_check
    check (period_start <= period_end),
  constraint finance_month_closes_user_period_unique
    unique (user_id, period_key)
);

create index if not exists idx_finance_month_closes_user_period
  on public.finance_month_closes (user_id, period_key desc);

drop trigger if exists trg_finance_month_closes_updated_at on public.finance_month_closes;
create trigger trg_finance_month_closes_updated_at
before update on public.finance_month_closes
for each row execute function public.set_netvisualizer_updated_at();

alter table public.finance_month_closes enable row level security;

drop policy if exists finance_month_closes_public_server_select on public.finance_month_closes;
create policy finance_month_closes_public_server_select
on public.finance_month_closes for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists finance_month_closes_public_server_insert on public.finance_month_closes;
create policy finance_month_closes_public_server_insert
on public.finance_month_closes for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists finance_month_closes_public_server_update on public.finance_month_closes;
create policy finance_month_closes_public_server_update
on public.finance_month_closes for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists finance_month_closes_public_server_delete on public.finance_month_closes;
create policy finance_month_closes_public_server_delete
on public.finance_month_closes for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

comment on table public.finance_month_closes is
  'Per-user payday-month review state and transaction classification overrides.';
