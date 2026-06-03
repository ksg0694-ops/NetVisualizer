alter table public.portfolios
  add column if not exists strategy_tag text,
  add column if not exists avg_buy_price numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'portfolios_strategy_tag_check'
  ) then
    alter table public.portfolios
      add constraint portfolios_strategy_tag_check
      check (
        strategy_tag is null
        or strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')
      ) not valid;
  end if;
end $$;

comment on column public.portfolios.strategy_tag is
  'Investment strategy tag used by NetVisualizer Quant views.';
comment on column public.portfolios.avg_buy_price is
  'Optional average buy price per share/unit. Currency follows the row currency.';

update public.portfolios
set strategy_tag = case
  when asset_type = 'account' then 'cash'
  when asset_type = 'pension' then 'pension'
  when asset_type = 'etf' then 'index'
  when lower(coalesce(name, '')) like '%배당%'
    or lower(coalesce(name, '')) like '%dividend%'
    or lower(coalesce(name, '')) like '%schd%'
    or lower(coalesce(name, '')) like '%리츠%'
    or lower(coalesce(name, '')) like '%맥쿼리%'
    then 'dividend'
  when lower(coalesce(name, '')) like '%지수%'
    or lower(coalesce(name, '')) like '%index%'
    or lower(coalesce(name, '')) like '%s&p%'
    or lower(coalesce(name, '')) like '%sp500%'
    or lower(coalesce(name, '')) like '%voo%'
    or lower(coalesce(name, '')) like '%qqq%'
    or lower(coalesce(name, '')) like '%spy%'
    or lower(coalesce(name, '')) like '%kodex%'
    or lower(coalesce(name, '')) like '%tiger%'
    or lower(coalesce(name, '')) like '%arirang%'
    then 'index'
  when asset_type = 'stock' then 'growth'
  else 'other'
end
where strategy_tag is null;
