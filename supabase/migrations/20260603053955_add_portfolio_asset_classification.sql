alter table public.portfolios
  add column if not exists asset_type text,
  add column if not exists instrument_type text,
  add column if not exists ticker text,
  add column if not exists risk_bucket text,
  add column if not exists classification_source text,
  add column if not exists classification_updated_at timestamptz;

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
end $$;

comment on column public.portfolios.asset_type is 'High-level asset class used by NetVisualizer risk and quant features.';
comment on column public.portfolios.instrument_type is 'Detailed instrument type, e.g. cash_account, safe_account, domestic_stock, us_etf, pension.';
comment on column public.portfolios.ticker is 'Optional market symbol for quote and quant integrations.';
comment on column public.portfolios.risk_bucket is 'Risk bucket for portfolio risk assessment.';
comment on column public.portfolios.classification_source is 'rule, manual, import, or db.';
comment on column public.portfolios.classification_updated_at is 'Last time classification metadata was set.';

update public.portfolios
set
  asset_type = case
    when lower(group_name) like '%부채%' or lower(group_name) like '%대출%' then 'debt'
    when lower(group_name) like '%연금%' or lower(group_name) like '%퇴직%' or lower(group_name) like '%irp%' then 'pension'
    when lower(group_name) like '%현금%' or lower(group_name) like '%입출금%' or lower(group_name) like '%통장%' or lower(group_name) like '%계좌%' or lower(group_name) like '%예수금%' then 'account'
    when lower(group_name) like '%안전%' or lower(group_name) like '%예금%' or lower(group_name) like '%적금%' or lower(group_name) like '%cma%' or lower(group_name) like '%파킹%' or lower(group_name) like '%rp%' or lower(group_name) like '%발행어음%' or lower(group_name) like '%채권%' then 'account'
    when lower(group_name) like '%청약%' or lower(group_name) like '%부동산%' or lower(group_name) like '%보증금%' or lower(group_name) like '%전세%' then 'real_estate'
    when lower(group_name) like '%투자%' and (lower(name) like '%etf%' or lower(name) like '%voo%' or lower(name) like '%qqq%' or lower(name) like '%schd%' or lower(name) like '%spy%' or lower(name) like '%s&p%' or lower(name) like '%kodex%' or lower(name) like '%tiger%' or lower(name) like '%arirang%' or lower(name) like '%ace %' or lower(name) like '%sol %') then 'etf'
    when lower(group_name) like '%투자%' or lower(group_name) like '%주식%' or lower(group_name) like '%증권%' or shares is not null then 'stock'
    else 'other'
  end,
  instrument_type = case
    when lower(group_name) like '%부채%' or lower(group_name) like '%대출%' then 'loan'
    when lower(group_name) like '%연금%' or lower(group_name) like '%퇴직%' or lower(group_name) like '%irp%' then 'pension'
    when lower(group_name) like '%현금%' or lower(group_name) like '%입출금%' or lower(group_name) like '%통장%' or lower(group_name) like '%계좌%' or lower(group_name) like '%예수금%' then 'cash_account'
    when lower(group_name) like '%안전%' or lower(group_name) like '%예금%' or lower(group_name) like '%적금%' or lower(group_name) like '%cma%' or lower(group_name) like '%파킹%' or lower(group_name) like '%rp%' or lower(group_name) like '%발행어음%' or lower(group_name) like '%채권%' then 'safe_account'
    when lower(group_name) like '%청약%' or lower(group_name) like '%부동산%' or lower(group_name) like '%보증금%' or lower(group_name) like '%전세%' then 'housing_ready'
    when lower(group_name) like '%투자%' and (lower(name) like '%etf%' or lower(name) like '%voo%' or lower(name) like '%qqq%' or lower(name) like '%schd%' or lower(name) like '%spy%' or lower(name) like '%s&p%' or lower(name) like '%kodex%' or lower(name) like '%tiger%' or lower(name) like '%arirang%' or lower(name) like '%ace %' or lower(name) like '%sol %') then 'etf'
    when lower(group_name) like '%투자%' or lower(group_name) like '%주식%' or lower(group_name) like '%증권%' or shares is not null then 'stock'
    else 'other'
  end,
  risk_bucket = case
    when lower(group_name) like '%부채%' or lower(group_name) like '%대출%' then 'debt'
    when lower(group_name) like '%연금%' or lower(group_name) like '%퇴직%' or lower(group_name) like '%irp%' then 'tied'
    when lower(group_name) like '%현금%' or lower(group_name) like '%안전%' or lower(group_name) like '%입출금%' or lower(group_name) like '%통장%' or lower(group_name) like '%계좌%' or lower(group_name) like '%예수금%' or lower(group_name) like '%예금%' or lower(group_name) like '%적금%' or lower(group_name) like '%cma%' or lower(group_name) like '%파킹%' or lower(group_name) like '%rp%' or lower(group_name) like '%발행어음%' or lower(group_name) like '%채권%' then 'safe'
    when lower(group_name) like '%청약%' or lower(group_name) like '%부동산%' or lower(group_name) like '%보증금%' or lower(group_name) like '%전세%' then 'tied'
    when lower(group_name) like '%투자%' or lower(group_name) like '%주식%' or lower(group_name) like '%증권%' or shares is not null then 'market'
    else 'other'
  end,
  classification_source = 'manual',
  classification_updated_at = now();;
