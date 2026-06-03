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
