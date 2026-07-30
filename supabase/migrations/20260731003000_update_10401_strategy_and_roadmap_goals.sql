-- Update 1.04.01: user-managed portfolio strategies and calendar-year roadmap goals.

alter table public.portfolios
  drop constraint if exists portfolios_strategy_tag_check;

comment on column public.portfolios.strategy_tag is
  'Stable strategy key linked to portfolio_strategy_definitions. Custom keys are allowed.';

create table if not exists public.portfolio_strategy_definitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.netvisualizer_public_owner_id(),
  strategy_tag text not null,
  label text not null,
  color text not null default '#64748b',
  icon text not null default 'fa-layer-group',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_strategy_definitions_user_tag_key unique (user_id, strategy_tag),
  constraint portfolio_strategy_definitions_tag_check
    check (strategy_tag ~ '^[a-z0-9_]{2,64}$'),
  constraint portfolio_strategy_definitions_label_check
    check (char_length(btrim(label)) between 1 and 40)
);

create index if not exists idx_portfolio_strategy_definitions_user_order
  on public.portfolio_strategy_definitions (user_id, display_order, created_at);

drop trigger if exists trg_portfolio_strategy_definitions_updated_at
  on public.portfolio_strategy_definitions;
create trigger trg_portfolio_strategy_definitions_updated_at
before update on public.portfolio_strategy_definitions
for each row execute function public.set_netvisualizer_updated_at();

insert into public.portfolio_strategy_definitions
  (user_id, strategy_tag, label, color, icon, display_order)
values
  (public.netvisualizer_public_owner_id(), 'cash', '현금대기', '#64748b', 'fa-vault', 10),
  (public.netvisualizer_public_owner_id(), 'commodity', '원자재', '#d97706', 'fa-gem', 20),
  (public.netvisualizer_public_owner_id(), 'dividend', '배당주', '#059669', 'fa-coins', 30),
  (public.netvisualizer_public_owner_id(), 'crypto', '가상화폐', '#7c3aed', 'fa-bitcoin-sign', 40),
  (public.netvisualizer_public_owner_id(), 'financial', '금융주', '#2563eb', 'fa-building-columns', 50),
  (public.netvisualizer_public_owner_id(), 'ai_semiconductor', 'AI(반도체)', '#db2777', 'fa-microchip', 60)
on conflict (user_id, strategy_tag) do nothing;

alter table public.portfolio_strategy_definitions enable row level security;

drop policy if exists portfolio_strategy_definitions_public_server_select
  on public.portfolio_strategy_definitions;
create policy portfolio_strategy_definitions_public_server_select
on public.portfolio_strategy_definitions for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_strategy_definitions_public_server_insert
  on public.portfolio_strategy_definitions;
create policy portfolio_strategy_definitions_public_server_insert
on public.portfolio_strategy_definitions for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_strategy_definitions_public_server_update
  on public.portfolio_strategy_definitions;
create policy portfolio_strategy_definitions_public_server_update
on public.portfolio_strategy_definitions for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

create table if not exists public.short_term_roadmap_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.netvisualizer_public_owner_id(),
  calendar_year integer not null,
  target_asset bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint short_term_roadmap_goals_user_year_key unique (user_id, calendar_year),
  constraint short_term_roadmap_goals_year_check check (calendar_year between 2020 and 2100),
  constraint short_term_roadmap_goals_target_check check (target_asset is null or target_asset >= 0)
);

create index if not exists idx_short_term_roadmap_goals_user_year
  on public.short_term_roadmap_goals (user_id, calendar_year);

drop trigger if exists trg_short_term_roadmap_goals_updated_at
  on public.short_term_roadmap_goals;
create trigger trg_short_term_roadmap_goals_updated_at
before update on public.short_term_roadmap_goals
for each row execute function public.set_netvisualizer_updated_at();

insert into public.short_term_roadmap_goals (user_id, calendar_year, target_asset)
values
  (public.netvisualizer_public_owner_id(), 2026, null),
  (public.netvisualizer_public_owner_id(), 2027, null),
  (public.netvisualizer_public_owner_id(), 2028, null)
on conflict (user_id, calendar_year) do nothing;

alter table public.short_term_roadmap_goals enable row level security;

drop policy if exists short_term_roadmap_goals_public_server_select
  on public.short_term_roadmap_goals;
create policy short_term_roadmap_goals_public_server_select
on public.short_term_roadmap_goals for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists short_term_roadmap_goals_public_server_insert
  on public.short_term_roadmap_goals;
create policy short_term_roadmap_goals_public_server_insert
on public.short_term_roadmap_goals for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists short_term_roadmap_goals_public_server_update
  on public.short_term_roadmap_goals;
create policy short_term_roadmap_goals_public_server_update
on public.short_term_roadmap_goals for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);
