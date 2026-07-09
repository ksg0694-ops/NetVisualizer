-- Backfill compatibility for live projects whose finance tables predate the
-- consolidated migration ledger.
--
-- The ledger migration installs updated_at triggers on these tables. Older live
-- tables may not yet have the timestamp columns because CREATE TABLE IF NOT
-- EXISTS does not add missing columns to an existing table.

alter table public.transactions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.assets
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.portfolios
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.cards
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.insurances
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();
