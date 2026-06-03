create table if not exists public.quant_rebalance_signals (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  strategy_tag text not null,
  strategy_label text not null,
  current_amount numeric not null default 0,
  target_amount numeric not null default 0,
  rebalance_amount numeric not null default 0,
  current_pct numeric not null default 0,
  target_pct numeric not null default 0,
  band_pct numeric not null default 0,
  status text not null,
  trigger_label text not null default '',
  item_count integer not null default 0,
  ticker_ready_count integer not null default 0,
  avg_ready_count integer not null default 0,
  price_ready_count integer not null default 0,
  missing_data_count integer not null default 0,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint quant_rebalance_signals_strategy_check
    check (strategy_tag in ('dividend', 'index', 'growth', 'cash', 'pension', 'other')),
  constraint quant_rebalance_signals_status_check
    check (status in ('wait', 'data_needed', 'rebalance', 'ok'))
);

comment on table public.quant_rebalance_signals is
  'Generated NetVisualizer Quant rebalance signal snapshots.';
comment on column public.quant_rebalance_signals.rebalance_amount is
  'Target amount minus current DB evaluation amount. Positive means buy/add; negative means reduce.';
comment on column public.quant_rebalance_signals.status is
  'wait, data_needed, rebalance, or ok.';

create index if not exists idx_quant_rebalance_signals_group_generated
  on public.quant_rebalance_signals (group_name, generated_at desc);

create index if not exists idx_quant_rebalance_signals_strategy_generated
  on public.quant_rebalance_signals (strategy_tag, generated_at desc);
