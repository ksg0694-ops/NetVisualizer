alter table public.portfolios
  add column if not exists account_name text;

comment on column public.portfolios.account_name is
  'Optional account or brokerage bucket name used to group investment holdings without storing raw account numbers.';;
