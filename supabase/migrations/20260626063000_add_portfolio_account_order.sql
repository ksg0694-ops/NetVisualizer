-- Add display order for brokerage/account grouping in portfolio views.
--
-- The value is stored per portfolio row, but rows with the same account_name
-- should share the same account_order. The app uses the minimum order value
-- found for each account bucket.

alter table public.portfolios
  add column if not exists account_order integer;

create index if not exists idx_portfolios_account_order
  on public.portfolios (account_order, account_name);

comment on column public.portfolios.account_order is
  'Optional display order for account_name groups in NetVisualizer portfolio and Quant views.';
