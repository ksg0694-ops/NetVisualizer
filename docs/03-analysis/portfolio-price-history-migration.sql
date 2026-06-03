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
