alter table public.portfolios
  drop constraint if exists portfolios_strategy_tag_check;

update public.portfolios
set strategy_tag = case
  when asset_type = 'debt' or amount < 0 then null
  when asset_type = 'account' then 'cash'
  when lower(coalesce(name, '')) like any (array[
    '%treasury bond%',
    '%국채%',
    '%채권%',
    '%mmf%',
    '%sgov%',
    '%tlt%',
    '%ief%'
  ]) then 'cash'
  when lower(coalesce(name, '')) like any (array[
    '%crypto%',
    '%bitcoin%',
    '%ethereum%',
    '%가상화폐%',
    '%비트코인%'
  ]) or upper(coalesce(ticker, '')) in ('BITW', 'BTC', 'ETH') then 'crypto'
  when lower(coalesce(name, '')) like any (array[
    '%commodity%',
    '%commoditiy%',
    '%precious%',
    '%원자재%',
    '%금현물%',
    '%gold%',
    '%태광산업%',
    '%chile%'
  ]) or upper(coalesce(ticker, '')) in ('GLTR', 'PDBC', 'ECH', '411060', '003240') then 'commodity'
  when lower(coalesce(name, '')) like any (array[
    '%증권%',
    '%은행%',
    '%보험%',
    '%금융%',
    '%broker%'
  ]) then 'financial'
  when lower(coalesce(name, '')) like any (array[
    '%반도체%',
    '%semiconductor%',
    '%인도%',
    '%nifty%',
    '%ai%',
    '%xovr%'
  ]) or upper(coalesce(ticker, '')) in ('006260', '396520', '453810', '453870', 'XOVR') then 'ai_semiconductor'
  when lower(coalesce(name, '')) like any (array[
    '%배당%',
    '%dividend%',
    '%리츠%',
    '%income%',
    '%밸류업%',
    '%value%'
  ]) or upper(coalesce(ticker, '')) in ('O', 'QSR') then 'dividend'
  when asset_type in ('stock', 'etf', 'pension') or shares > 0 then 'dividend'
  else null
end;

alter table public.portfolios
  add constraint portfolios_strategy_tag_check
  check (
    strategy_tag is null
    or strategy_tag in ('cash', 'commodity', 'dividend', 'crypto', 'financial', 'ai_semiconductor')
  );

comment on column public.portfolios.strategy_tag is
  'Update 1.04 portfolio strategy: cash, commodity, dividend, crypto, financial, or ai_semiconductor.';
