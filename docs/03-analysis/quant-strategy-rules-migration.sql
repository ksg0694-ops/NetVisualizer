create table if not exists public.quant_strategy_rules (
  strategy_tag text primary key,
  target_pct numeric not null default 0,
  band_pct numeric not null default 0,
  trigger_label text not null default '',
  is_active boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint quant_strategy_rules_strategy_tag_check
    check (strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')),
  constraint quant_strategy_rules_target_pct_check
    check (target_pct >= 0 and target_pct <= 100),
  constraint quant_strategy_rules_band_pct_check
    check (band_pct >= 0 and band_pct <= 100)
);

comment on table public.quant_strategy_rules is
  'NetVisualizer Quant strategy target weights and rebalance bands.';
comment on column public.quant_strategy_rules.strategy_tag is
  'Strategy key shared with portfolios.strategy_tag.';
comment on column public.quant_strategy_rules.target_pct is
  'Target portfolio weight percent.';
comment on column public.quant_strategy_rules.band_pct is
  'Allowed drift from target percent before rebalance signal.';
comment on column public.quant_strategy_rules.trigger_label is
  'Human-readable signal basis for the strategy.';

insert into public.quant_strategy_rules
  (strategy_tag, target_pct, band_pct, trigger_label, is_active, display_order)
values
  ('dividend', 25, 5, '배당률', true, 10),
  ('index', 45, 7, '추세', true, 20),
  ('growth', 20, 6, '모멘텀', true, 30),
  ('cash', 10, 4, 'MDD 방어', true, 40),
  ('pension', 0, 0, '장기보유', true, 50),
  ('other', 0, 0, '수동검토', true, 60)
on conflict (strategy_tag) do update set
  target_pct = excluded.target_pct,
  band_pct = excluded.band_pct,
  trigger_label = excluded.trigger_label,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  updated_at = now();
