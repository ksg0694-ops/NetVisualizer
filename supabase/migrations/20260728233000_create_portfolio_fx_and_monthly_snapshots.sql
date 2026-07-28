-- Portfolio Phase 2: KRW conversion references and reproducible monthly position snapshots.

create extension if not exists pgcrypto;

create table if not exists public.portfolio_fx_rates (
  currency text primary key,
  krw_per_unit numeric(20, 8) not null check (krw_per_unit > 0),
  rate_date date not null,
  source text not null default 'manual',
  source_label text not null default '',
  updated_at timestamptz not null default now(),
  constraint portfolio_fx_rates_currency_check
    check (currency ~ '^[A-Z]{3}$')
);

insert into public.portfolio_fx_rates (
  currency,
  krw_per_unit,
  rate_date,
  source,
  source_label
)
values
  ('USD', 1470.1115, '2026-07-27', 'ecb-cross', 'ECB EUR 교차환율'),
  ('JPY', 8.9839, '2026-07-27', 'ecb-cross', 'ECB EUR 교차환율'),
  ('EUR', 1674.31, '2026-07-27', 'ecb', 'ECB 기준환율')
on conflict (currency) do update
set
  krw_per_unit = excluded.krw_per_unit,
  rate_date = excluded.rate_date,
  source = excluded.source,
  source_label = excluded.source_label,
  updated_at = now();

alter table public.portfolio_fx_rates enable row level security;

drop policy if exists portfolio_fx_rates_public_select on public.portfolio_fx_rates;
create policy portfolio_fx_rates_public_select
on public.portfolio_fx_rates for select to anon, authenticated
using (true);

create table if not exists public.portfolio_monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
    default coalesce(auth.uid(), public.netvisualizer_public_owner_id()),
  snapshot_month text not null,
  snapshot_date date not null,
  total_valuation_krw bigint not null default 0 check (total_valuation_krw >= 0),
  total_stored_amount_krw bigint not null default 0 check (total_stored_amount_krw >= 0),
  position_count integer not null default 0 check (position_count >= 0),
  price_coverage_pct numeric(7, 4) not null default 0
    check (price_coverage_pct between 0 and 100),
  fx_coverage_pct numeric(7, 4) not null default 0
    check (fx_coverage_pct between 0 and 100),
  port_totals jsonb not null default '[]'::jsonb
    check (jsonb_typeof(port_totals) = 'array'),
  positions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(positions) = 'array'),
  source_revision text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_monthly_snapshots_month_check
    check (snapshot_month ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint portfolio_monthly_snapshots_user_month_unique
    unique (user_id, snapshot_month)
);

create index if not exists idx_portfolio_monthly_snapshots_user_month
  on public.portfolio_monthly_snapshots (user_id, snapshot_month desc);

drop trigger if exists trg_portfolio_monthly_snapshots_updated_at
  on public.portfolio_monthly_snapshots;
create trigger trg_portfolio_monthly_snapshots_updated_at
before update on public.portfolio_monthly_snapshots
for each row execute function public.set_netvisualizer_updated_at();

alter table public.portfolio_monthly_snapshots enable row level security;

drop policy if exists portfolio_monthly_snapshots_public_server_select
  on public.portfolio_monthly_snapshots;
create policy portfolio_monthly_snapshots_public_server_select
on public.portfolio_monthly_snapshots for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_monthly_snapshots_public_server_insert
  on public.portfolio_monthly_snapshots;
create policy portfolio_monthly_snapshots_public_server_insert
on public.portfolio_monthly_snapshots for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_monthly_snapshots_public_server_update
  on public.portfolio_monthly_snapshots;
create policy portfolio_monthly_snapshots_public_server_update
on public.portfolio_monthly_snapshots for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_monthly_snapshots_public_server_delete
  on public.portfolio_monthly_snapshots;
create policy portfolio_monthly_snapshots_public_server_delete
on public.portfolio_monthly_snapshots for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

comment on table public.portfolio_fx_rates is
  'Latest KRW-per-unit reference rates used for portfolio valuation.';
comment on table public.portfolio_monthly_snapshots is
  'Monthly position snapshots preserving Port totals and per-holding valuation inputs.';
