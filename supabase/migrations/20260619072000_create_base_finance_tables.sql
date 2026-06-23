-- Base NetVisualizer finance tables.
--
-- This migration documents the current static app's core Supabase contract for
-- fresh local or remote environments. It intentionally does not change RLS.

create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time,
  type text not null,
  category text,
  subcategory text,
  memo text,
  amount numeric not null default 0,
  currency text not null default 'KRW',
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_date_time
  on public.transactions (date, time);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  total_asset numeric not null default 0,
  cash numeric not null default 0,
  safe numeric not null default 0,
  invest numeric not null default 0,
  debt numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  name text not null,
  currency text not null default 'KRW',
  maturity text,
  amount numeric not null default 0,
  shares numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portfolios_group_name
  on public.portfolios (group_name);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank text,
  purpose text,
  image_data text,
  target_amt numeric,
  annual_fee numeric,
  prt_ideal text,
  prt_real text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insurances (
  id uuid primary key default gen_random_uuid(),
  category text,
  description text not null,
  company text,
  monthly_payment numeric not null default 0,
  pay_day integer check (pay_day is null or pay_day between 1 and 31),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_netvisualizer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row execute function public.set_netvisualizer_updated_at();

drop trigger if exists trg_assets_updated_at on public.assets;
create trigger trg_assets_updated_at
before update on public.assets
for each row execute function public.set_netvisualizer_updated_at();

drop trigger if exists trg_portfolios_updated_at on public.portfolios;
create trigger trg_portfolios_updated_at
before update on public.portfolios
for each row execute function public.set_netvisualizer_updated_at();

drop trigger if exists trg_cards_updated_at on public.cards;
create trigger trg_cards_updated_at
before update on public.cards
for each row execute function public.set_netvisualizer_updated_at();

drop trigger if exists trg_insurances_updated_at on public.insurances;
create trigger trg_insurances_updated_at
before update on public.insurances
for each row execute function public.set_netvisualizer_updated_at();

comment on table public.transactions is
  'NetVisualizer income, expense, and transfer rows.';
comment on table public.assets is
  'Monthly net-worth snapshots used for long-term asset trend views.';
comment on table public.portfolios is
  'Current account, holding, debt, and portfolio rows.';
comment on table public.cards is
  'Optional card benefit and annual-fee reference rows.';
comment on table public.insurances is
  'Optional recurring insurance payment rows.';
