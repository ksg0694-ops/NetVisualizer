-- NetVisualizer asset classification migration draft
-- Apply manually in Supabase SQL editor after localStorage override behavior is verified.

alter table portfolios
  add column if not exists asset_type text,
  add column if not exists instrument_type text,
  add column if not exists ticker text,
  add column if not exists risk_bucket text,
  add column if not exists classification_source text,
  add column if not exists classification_updated_at timestamptz;

alter table portfolios
  add constraint portfolios_asset_type_check
  check (
    asset_type is null
    or asset_type in ('account', 'pension', 'stock', 'etf', 'real_estate', 'debt', 'other')
  ) not valid;

alter table portfolios
  add constraint portfolios_risk_bucket_check
  check (
    risk_bucket is null
    or risk_bucket in ('safe', 'market', 'debt', 'tied', 'other')
  ) not valid;

alter table portfolios
  add constraint portfolios_classification_source_check
  check (
    classification_source is null
    or classification_source in ('rule', 'manual', 'import', 'db')
  ) not valid;

comment on column portfolios.asset_type is 'High-level asset class used by NetVisualizer risk and quant features.';
comment on column portfolios.instrument_type is 'Detailed instrument type, e.g. deposit, domestic_stock, us_etf.';
comment on column portfolios.ticker is 'Optional market symbol for quote and quant integrations.';
comment on column portfolios.risk_bucket is 'Risk bucket for portfolio risk assessment.';
comment on column portfolios.classification_source is 'rule, manual, import, or db.';
comment on column portfolios.classification_updated_at is 'Last time classification metadata was set.';
