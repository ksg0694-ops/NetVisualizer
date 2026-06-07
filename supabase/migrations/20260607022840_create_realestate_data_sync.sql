-- NetVisualizer real estate / housing subscription data model.
-- Source candidates:
-- - Korea Real Estate Board Applyhome subscription APIs (data.go.kr / ODcloud)
-- - MOLIT apartment transaction APIs (data.go.kr)
--
-- RLS is intentionally not changed here because the current project tables are
-- still operated without RLS. Revisit RLS as a separate security-hardening step.

create extension if not exists pgcrypto;

create table if not exists public.real_estate_subscription_sites (
  id uuid primary key default gen_random_uuid(),
  block text not null,
  site_name text not null,
  region text,
  district text,
  supply_count integer,
  housing_type text,
  sale_type text,
  priority text default '관심',
  priority_order integer default 99,
  budget_note text,
  key_point text,
  target_budget numeric(14, 0),
  expected_notice_month date,
  main_subscription_date date,
  special_supply_start_date date,
  special_supply_end_date date,
  general_supply_start_date date,
  general_supply_end_date date,
  winner_announcement_date date,
  contract_start_date date,
  contract_end_date date,
  latitude double precision,
  longitude double precision,
  color text,
  status text default 'planned',
  source text default 'manual',
  source_url text,
  source_notice_no text,
  source_house_manage_no text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block, site_name)
);

create table if not exists public.real_estate_housing_types (
  id uuid primary key default gen_random_uuid(),
  subscription_site_id uuid references public.real_estate_subscription_sites(id) on delete cascade,
  source_notice_no text,
  source_house_manage_no text,
  model_no text,
  housing_type text,
  exclusive_area numeric(8, 3),
  supply_area numeric(8, 3),
  total_supply_count integer,
  general_supply_count integer,
  special_supply_count integer,
  special_multi_child_count integer,
  special_newlywed_count integer,
  special_first_life_count integer,
  special_elderly_parent_count integer,
  special_institution_count integer,
  max_sale_price_krw numeric(14, 0),
  source text default 'manual',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_house_manage_no, source_notice_no, model_no)
);

create table if not exists public.real_estate_competition (
  id uuid primary key default gen_random_uuid(),
  subscription_site_id uuid references public.real_estate_subscription_sites(id) on delete cascade,
  source_notice_no text,
  source_house_manage_no text,
  model_no text,
  housing_type text,
  supply_count integer,
  rank_no integer,
  residence_area text,
  applications integer,
  competition_rate text,
  source text default 'manual',
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_house_manage_no, source_notice_no, model_no, rank_no, residence_area)
);

create table if not exists public.real_estate_price_refs (
  id uuid primary key default gen_random_uuid(),
  apartment_name text not null,
  region_code text,
  region_name text,
  legal_dong text,
  deal_date date,
  deal_amount_krw numeric(14, 0),
  exclusive_area numeric(8, 3),
  floor_no integer,
  build_year integer,
  latitude double precision,
  longitude double precision,
  source text default 'molit',
  source_payload jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (apartment_name, region_code, legal_dong, deal_date, exclusive_area, floor_no, deal_amount_krw)
);

create or replace function public.set_real_estate_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_real_estate_subscription_sites_updated_at on public.real_estate_subscription_sites;
create trigger trg_real_estate_subscription_sites_updated_at
before update on public.real_estate_subscription_sites
for each row execute function public.set_real_estate_updated_at();

drop trigger if exists trg_real_estate_housing_types_updated_at on public.real_estate_housing_types;
create trigger trg_real_estate_housing_types_updated_at
before update on public.real_estate_housing_types
for each row execute function public.set_real_estate_updated_at();

drop trigger if exists trg_real_estate_competition_updated_at on public.real_estate_competition;
create trigger trg_real_estate_competition_updated_at
before update on public.real_estate_competition
for each row execute function public.set_real_estate_updated_at();

drop trigger if exists trg_real_estate_price_refs_updated_at on public.real_estate_price_refs;
create trigger trg_real_estate_price_refs_updated_at
before update on public.real_estate_price_refs
for each row execute function public.set_real_estate_updated_at();

insert into public.real_estate_subscription_sites (
  block,
  site_name,
  region,
  district,
  supply_count,
  housing_type,
  sale_type,
  priority,
  priority_order,
  budget_note,
  key_point,
  target_budget,
  expected_notice_month,
  latitude,
  longitude,
  color,
  status,
  source,
  source_url
) values
  (
    'S2',
    '고양창릉 S-02',
    '경기',
    '고양시',
    1057,
    '나눔형 공공분양',
    '공공분양',
    '가장 중요',
    1,
    '가장 중요',
    '사전청약 없이 전량 본청약 예정',
    800000000,
    date '2026-06-01',
    37.6292,
    126.8727,
    '#4F46E5',
    'planned',
    'manual_seed',
    'https://www.applyhome.co.kr'
  ),
  (
    'S3',
    '고양창릉 S-03',
    '경기',
    '고양시',
    1306,
    '나눔형 공공분양',
    '공공분양',
    '매우 중요',
    2,
    '매우 중요',
    '물량 큼, 생애최초 가능 여부 확인 필요',
    800000000,
    date '2026-06-01',
    37.6250,
    126.8668,
    '#10B981',
    'planned',
    'manual_seed',
    'https://www.applyhome.co.kr'
  ),
  (
    'S4',
    '고양창릉 S-04',
    '경기',
    '고양시',
    1024,
    '공공분양',
    '공공분양',
    '매우 중요',
    3,
    '매우 중요',
    '6월 예정 대형 물량, 일반형 조건 우선 확인',
    800000000,
    date '2026-06-01',
    37.6208,
    126.8612,
    '#2563EB',
    'planned',
    'manual_seed',
    'https://www.applyhome.co.kr'
  )
on conflict (block, site_name) do update set
  supply_count = excluded.supply_count,
  housing_type = excluded.housing_type,
  priority = excluded.priority,
  priority_order = excluded.priority_order,
  budget_note = excluded.budget_note,
  key_point = excluded.key_point,
  target_budget = excluded.target_budget,
  expected_notice_month = excluded.expected_notice_month,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  color = excluded.color,
  status = excluded.status,
  source = excluded.source,
  source_url = excluded.source_url;
