-- Consolidated NetVisualizer finance / Quant schema.
--
-- This migration collects the already-designed portfolio metadata, market
-- price cache, strategy rules, price history, and rebalance signal tables into
-- the real Supabase migration ledger. It intentionally does not change RLS.
-- It assumes the base finance tables, including public.portfolios, already
-- exist in the project.

create extension if not exists pgcrypto;

alter table public.portfolios
  add column if not exists asset_type text,
  add column if not exists instrument_type text,
  add column if not exists ticker text,
  add column if not exists risk_bucket text,
  add column if not exists classification_source text,
  add column if not exists classification_updated_at timestamptz,
  add column if not exists strategy_tag text,
  add column if not exists avg_buy_price numeric,
  add column if not exists account_name text,
  add column if not exists shares numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portfolios_asset_type_check') then
    alter table public.portfolios
      add constraint portfolios_asset_type_check
      check (
        asset_type is null
        or asset_type in ('account', 'pension', 'stock', 'etf', 'real_estate', 'debt', 'other')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_risk_bucket_check') then
    alter table public.portfolios
      add constraint portfolios_risk_bucket_check
      check (
        risk_bucket is null
        or risk_bucket in ('safe', 'market', 'debt', 'tied', 'other')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_classification_source_check') then
    alter table public.portfolios
      add constraint portfolios_classification_source_check
      check (
        classification_source is null
        or classification_source in ('rule', 'manual', 'import', 'db')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_strategy_tag_check') then
    alter table public.portfolios
      add constraint portfolios_strategy_tag_check
      check (
        strategy_tag is null
        or strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')
      ) not valid;
  end if;
end $$;

comment on column public.portfolios.asset_type is
  'High-level asset class used by NetVisualizer risk and Quant features.';
comment on column public.portfolios.instrument_type is
  'Detailed instrument type, such as deposit, domestic_stock, or us_etf.';
comment on column public.portfolios.ticker is
  'Optional market symbol for quote and Quant integrations.';
comment on column public.portfolios.risk_bucket is
  'Risk bucket for portfolio risk assessment.';
comment on column public.portfolios.classification_source is
  'Source for the asset classification: rule, manual, import, or db.';
comment on column public.portfolios.classification_updated_at is
  'Last time classification metadata was set.';
comment on column public.portfolios.strategy_tag is
  'Investment strategy tag used by NetVisualizer Quant views.';
comment on column public.portfolios.avg_buy_price is
  'Optional average buy price per share/unit. Currency follows the row currency.';
comment on column public.portfolios.account_name is
  'Optional account or brokerage bucket name used to group investment holdings without storing raw account numbers.';

update public.portfolios
set strategy_tag = case
  when asset_type = 'account' then 'cash'
  when asset_type = 'pension' then 'pension'
  when asset_type = 'etf' then 'index'
  when asset_type = 'stock' then 'growth'
  else 'other'
end
where strategy_tag is null
  and asset_type is not null;

create table if not exists public.quant_strategy_rules (
  strategy_tag text primary key,
  target_pct numeric not null default 0,
  band_pct numeric not null default 0,
  trigger_label text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint quant_strategy_rules_strategy_tag_check
    check (strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')),
  constraint quant_strategy_rules_target_pct_check
    check (target_pct >= 0 and target_pct <= 100),
  constraint quant_strategy_rules_band_pct_check
    check (band_pct >= 0 and band_pct <= 100)
);

comment on table public.quant_strategy_rules is
  'NetVisualizer Quant strategy target weights and rebalance bands.';
comment on column public.quant_strategy_rules.strategy_tag is
  'Strategy key shared with portfolios.strategy_tag.';
comment on column public.quant_strategy_rules.target_pct is
  'Target portfolio weight percent.';
comment on column public.quant_strategy_rules.band_pct is
  'Allowed drift from target percent before rebalance signal.';
comment on column public.quant_strategy_rules.trigger_label is
  'Human-readable signal basis for the strategy.';

insert into public.quant_strategy_rules
  (strategy_tag, target_pct, band_pct, trigger_label, is_active, display_order)
values
  ('dividend', 25, 5, 'Dividend yield', true, 10),
  ('index', 45, 7, 'Trend', true, 20),
  ('growth', 20, 6, 'Momentum', true, 30),
  ('cash', 10, 4, 'Drawdown defense', true, 40),
  ('pension', 0, 0, 'Long hold', true, 50),
  ('other', 0, 0, 'Manual review', true, 60)
on conflict (strategy_tag) do nothing;

create table if not exists public.portfolio_market_prices (
  ticker text primary key,
  price numeric not null,
  currency text not null default 'KRW',
  price_date date not null default current_date,
  source text not null default 'manual',
  note text,
  updated_at timestamptz not null default now(),
  constraint portfolio_market_prices_price_check
    check (price >= 0),
  constraint portfolio_market_prices_source_check
    check (source in ('manual', 'import', 'api'))
);

comment on table public.portfolio_market_prices is
  'Latest manual/imported/API market prices used by NetVisualizer Quant views.';
comment on column public.portfolio_market_prices.ticker is
  'Uppercase market symbol shared with portfolios.ticker.';
comment on column public.portfolio_market_prices.price is
  'Latest unit price in the row currency.';
comment on column public.portfolio_market_prices.currency is
  'Currency of the latest unit price.';
comment on column public.portfolio_market_prices.price_date is
  'Date the price is valid for.';
comment on column public.portfolio_market_prices.source is
  'manual, import, or api.';

create index if not exists idx_portfolio_market_prices_updated_at
  on public.portfolio_market_prices (updated_at desc);

create table if not exists public.portfolio_price_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  price numeric not null,
  currency text not null default 'KRW',
  price_date date not null,
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  constraint portfolio_price_history_price_check
    check (price >= 0),
  constraint portfolio_price_history_source_check
    check (source in ('manual', 'import', 'api')),
  constraint portfolio_price_history_ticker_date_source_key
    unique (ticker, price_date, source)
);

comment on table public.portfolio_price_history is
  'Historical manual/imported/API market prices used by NetVisualizer Quant views.';
comment on column public.portfolio_price_history.ticker is
  'Uppercase market symbol shared with portfolios.ticker.';
comment on column public.portfolio_price_history.price is
  'Unit price for the ticker on price_date.';
comment on column public.portfolio_price_history.currency is
  'Currency of the unit price.';
comment on column public.portfolio_price_history.price_date is
  'Date the price is valid for.';
comment on column public.portfolio_price_history.source is
  'manual, import, or api.';

create index if not exists idx_portfolio_price_history_ticker_date
  on public.portfolio_price_history (ticker, price_date desc);

create table if not exists public.quant_rebalance_signals (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  strategy_tag text not null,
  strategy_label text not null,
  current_amount numeric not null default 0,
  target_amount numeric not null default 0,
  rebalance_amount numeric not null default 0,
  current_pct numeric not null default 0,
  target_pct numeric not null default 0,
  band_pct numeric not null default 0,
  status text not null,
  trigger_label text not null default '',
  item_count integer not null default 0,
  ticker_ready_count integer not null default 0,
  avg_ready_count integer not null default 0,
  price_ready_count integer not null default 0,
  missing_data_count integer not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint quant_rebalance_signals_strategy_check
    check (strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')),
  constraint quant_rebalance_signals_status_check
    check (status in ('wait', 'data_needed', 'rebalance', 'ok'))
);

comment on table public.quant_rebalance_signals is
  'Generated NetVisualizer Quant rebalance signal snapshots.';
comment on column public.quant_rebalance_signals.rebalance_amount is
  'Target amount minus current DB evaluation amount. Positive means buy/add; negative means reduce.';
comment on column public.quant_rebalance_signals.status is
  'wait, data_needed, rebalance, or ok.';

create index if not exists idx_quant_rebalance_signals_group_generated
  on public.quant_rebalance_signals (group_name, generated_at desc);

create index if not exists idx_quant_rebalance_signals_strategy_generated
  on public.quant_rebalance_signals (strategy_tag, generated_at desc);
