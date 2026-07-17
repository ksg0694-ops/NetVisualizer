-- Persist the user-owned Account / Asset / Purpose axes on each portfolio row.
-- Existing asset_type remains the legacy quote/Quant classification.

alter table public.portfolios
  add column if not exists account_provider text,
  add column if not exists account_type text,
  add column if not exists asset_class text,
  add column if not exists purpose_key text,
  add column if not exists mapping_review_status text,
  add column if not exists mapping_source text,
  add column if not exists mapping_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portfolios_account_type_check') then
    alter table public.portfolios
      add constraint portfolios_account_type_check
      check (
        account_type is null
        or account_type in ('bank', 'brokerage', 'savings', 'pension', 'direct', 'liability', 'other')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_asset_class_check') then
    alter table public.portfolios
      add constraint portfolios_asset_class_check
      check (
        asset_class is null
        or asset_class in (
          'cash', 'deposit', 'fixedIncome', 'equity', 'fund',
          'commodity', 'alternative', 'realEstate', 'liability', 'other'
        )
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_purpose_key_check') then
    alter table public.portfolios
      add constraint portfolios_purpose_key_check
      check (
        purpose_key is null
        or purpose_key in (
          'operating', 'defense', 'housing', 'growth',
          'humanCapital', 'experience', 'unassigned'
        )
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_mapping_review_status_check') then
    alter table public.portfolios
      add constraint portfolios_mapping_review_status_check
      check (
        mapping_review_status is null
        or mapping_review_status in ('unreviewed', 'needsChange', 'confirmed', 'hold')
      ) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolios_mapping_source_check') then
    alter table public.portfolios
      add constraint portfolios_mapping_source_check
      check (
        mapping_source is null
        or mapping_source in ('manual', 'google_sheet', 'import', 'rule')
      ) not valid;
  end if;
end $$;

comment on column public.portfolios.account_provider is
  'User-owned financial institution label for the containing account or creditor.';
comment on column public.portfolios.account_type is
  'User-owned account axis: bank, brokerage, savings, pension, direct, liability, or other.';
comment on column public.portfolios.asset_class is
  'User-owned economic asset axis independent from the product wrapper in asset_type.';
comment on column public.portfolios.purpose_key is
  'User-owned purpose axis used by Personal CFO.';
comment on column public.portfolios.mapping_review_status is
  'Review state for the user-owned Account / Asset / Purpose mapping.';
comment on column public.portfolios.mapping_source is
  'Origin of the user-owned Account / Asset / Purpose mapping.';
comment on column public.portfolios.mapping_updated_at is
  'Last time the user-owned Account / Asset / Purpose mapping changed.';
