-- Create user-owned override tables layered over shared Quant and market data.
--
-- Shared defaults/caches remain:
-- - public.quant_strategy_rules
-- - public.portfolio_market_prices
-- - public.portfolio_price_history
--
-- User edits are written only to the override tables below.

create extension if not exists pgcrypto;

create or replace function public.set_netvisualizer_override_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.quant_strategy_rule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  strategy_tag text not null,
  target_pct numeric not null default 0,
  band_pct numeric not null default 0,
  trigger_label text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quant_strategy_rule_overrides_strategy_tag_check
    check (strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')),
  constraint quant_strategy_rule_overrides_target_pct_check
    check (target_pct >= 0 and target_pct <= 100),
  constraint quant_strategy_rule_overrides_band_pct_check
    check (band_pct >= 0 and band_pct <= 100),
  constraint quant_strategy_rule_overrides_user_strategy_key
    unique (user_id, strategy_tag)
);

drop trigger if exists trg_quant_strategy_rule_overrides_updated_at on public.quant_strategy_rule_overrides;
create trigger trg_quant_strategy_rule_overrides_updated_at
before update on public.quant_strategy_rule_overrides
for each row execute function public.set_netvisualizer_override_updated_at();

create index if not exists idx_quant_strategy_rule_overrides_user_display_order
  on public.quant_strategy_rule_overrides (user_id, display_order);

comment on table public.quant_strategy_rule_overrides is
  'User-specific Quant strategy overrides layered over shared quant_strategy_rules defaults.';

create table if not exists public.portfolio_market_price_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ticker text not null,
  price numeric not null,
  currency text not null default 'KRW',
  price_date date not null default current_date,
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_market_price_overrides_price_check
    check (price >= 0),
  constraint portfolio_market_price_overrides_source_check
    check (source in ('manual', 'import')),
  constraint portfolio_market_price_overrides_user_ticker_key
    unique (user_id, ticker)
);

drop trigger if exists trg_portfolio_market_price_overrides_updated_at on public.portfolio_market_price_overrides;
create trigger trg_portfolio_market_price_overrides_updated_at
before update on public.portfolio_market_price_overrides
for each row execute function public.set_netvisualizer_override_updated_at();

create index if not exists idx_portfolio_market_price_overrides_user_updated_at
  on public.portfolio_market_price_overrides (user_id, updated_at desc);

comment on table public.portfolio_market_price_overrides is
  'Latest user-owned manual/imported market prices layered over shared API market cache.';

create table if not exists public.portfolio_market_price_override_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ticker text not null,
  price numeric not null,
  currency text not null default 'KRW',
  price_date date not null,
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  constraint portfolio_market_price_override_history_price_check
    check (price >= 0),
  constraint portfolio_market_price_override_history_source_check
    check (source in ('manual', 'import')),
  constraint portfolio_market_price_override_history_user_ticker_date_source_key
    unique (user_id, ticker, price_date, source)
);

create index if not exists idx_portfolio_market_price_override_history_user_ticker_date
  on public.portfolio_market_price_override_history (user_id, ticker, price_date desc);

comment on table public.portfolio_market_price_override_history is
  'Historical user-owned market price overrides for personal return tracking.';

alter table public.quant_strategy_rule_overrides enable row level security;
alter table public.portfolio_market_price_overrides enable row level security;
alter table public.portfolio_market_price_override_history enable row level security;

drop policy if exists quant_strategy_rule_overrides_select_own on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_select_own
on public.quant_strategy_rule_overrides
for select
using (auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_insert_own on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_insert_own
on public.quant_strategy_rule_overrides
for insert
with check (auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_update_own on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_update_own
on public.quant_strategy_rule_overrides
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_delete_own on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_delete_own
on public.quant_strategy_rule_overrides
for delete
using (auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_select_own on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_select_own
on public.portfolio_market_price_overrides
for select
using (auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_insert_own on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_insert_own
on public.portfolio_market_price_overrides
for insert
with check (auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_update_own on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_update_own
on public.portfolio_market_price_overrides
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_delete_own on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_delete_own
on public.portfolio_market_price_overrides
for delete
using (auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_select_own on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_select_own
on public.portfolio_market_price_override_history
for select
using (auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_insert_own on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_insert_own
on public.portfolio_market_price_override_history
for insert
with check (auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_update_own on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_update_own
on public.portfolio_market_price_override_history
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_delete_own on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_delete_own
on public.portfolio_market_price_override_history
for delete
using (auth.uid() = user_id);
