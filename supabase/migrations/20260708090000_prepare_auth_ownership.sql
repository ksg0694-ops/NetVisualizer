-- Prepare NetVisualizer for Supabase Auth ownership.
--
-- This migration is intentionally non-destructive:
-- - It adds nullable user_id ownership columns with auth.uid() defaults.
-- - It does not enable RLS yet.
-- - It does not drop existing global primary/unique constraints yet.
--
-- RLS enforcement must happen after existing rows are backfilled to the intended
-- owner and global uniqueness constraints are converted where needed.

create extension if not exists pgcrypto;

create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_app_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_user_profiles_updated_at on public.app_user_profiles;
create trigger trg_app_user_profiles_updated_at
before update on public.app_user_profiles
for each row execute function public.set_app_user_profiles_updated_at();

alter table public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_transactions_user_id_date
  on public.transactions (user_id, date, time);

alter table public.assets
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_assets_user_id_year_month
  on public.assets (user_id, year, month);

alter table public.portfolios
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_portfolios_user_id_group_name
  on public.portfolios (user_id, group_name);

alter table public.cards
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_cards_user_id_name
  on public.cards (user_id, name);

alter table public.insurances
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_insurances_user_id_category
  on public.insurances (user_id, category);

alter table public.health_weight_logs
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_health_weight_logs_user_id_log_date
  on public.health_weight_logs (user_id, log_date);

alter table public.quant_rebalance_signals
  add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index if not exists idx_quant_rebalance_signals_user_id_generated_at
  on public.quant_rebalance_signals (user_id, generated_at desc);

comment on table public.app_user_profiles is
  'NetVisualizer user profile rows keyed by Supabase Auth user.';

comment on column public.transactions.user_id is
  'Supabase Auth owner. Nullable until legacy rows are backfilled.';
comment on column public.assets.user_id is
  'Supabase Auth owner. Existing unique(year, month) must be converted before multi-user enforcement.';
comment on column public.portfolios.user_id is
  'Supabase Auth owner. Nullable until legacy rows are backfilled.';
comment on column public.cards.user_id is
  'Supabase Auth owner. Nullable until legacy rows are backfilled.';
comment on column public.insurances.user_id is
  'Supabase Auth owner. Nullable until legacy rows are backfilled.';
comment on column public.health_weight_logs.user_id is
  'Supabase Auth owner. Existing log_date primary key must be converted before multi-user enforcement.';
comment on column public.quant_rebalance_signals.user_id is
  'Supabase Auth owner. Nullable until legacy rows are backfilled.';
