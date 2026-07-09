-- Helper for finalizing Supabase Auth ownership after legacy rows are backfilled.
--
-- Default execution is dry-run only:
--   select public.finalize_netvisualizer_auth_rls();
--
-- Actual write:
--   select public.finalize_netvisualizer_auth_rls(false);
--
-- This migration only creates the helper. It does not enable legacy-table RLS
-- by itself, because the existing private rows must be assigned to an owner
-- before RLS and per-user constraints are safe to enforce.

create or replace function public.finalize_netvisualizer_auth_rls(
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_count integer := 0;
  v_total_nulls integer := 0;
begin
  select count(*) into v_count from public.transactions where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('transactions_null_user_id', v_count);

  select count(*) into v_count from public.assets where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('assets_null_user_id', v_count);

  select count(*) into v_count from public.portfolios where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('portfolios_null_user_id', v_count);

  select count(*) into v_count from public.cards where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('cards_null_user_id', v_count);

  select count(*) into v_count from public.insurances where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('insurances_null_user_id', v_count);

  select count(*) into v_count from public.health_weight_logs where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('health_weight_logs_null_user_id', v_count);

  select count(*) into v_count from public.quant_rebalance_signals where user_id is null;
  v_total_nulls := v_total_nulls + v_count;
  v_counts := v_counts || jsonb_build_object('quant_rebalance_signals_null_user_id', v_count);

  if p_dry_run then
    return jsonb_build_object(
      'dryRun', true,
      'readyToFinalize', v_total_nulls = 0,
      'counts', v_counts
    );
  end if;

  if v_total_nulls > 0 then
    raise exception 'cannot finalize Auth RLS while % legacy rows still have null user_id', v_total_nulls;
  end if;

  alter table public.transactions alter column user_id set not null;
  alter table public.assets alter column user_id set not null;
  alter table public.portfolios alter column user_id set not null;
  alter table public.cards alter column user_id set not null;
  alter table public.insurances alter column user_id set not null;
  alter table public.health_weight_logs alter column user_id set not null;
  alter table public.quant_rebalance_signals alter column user_id set not null;

  alter table public.assets drop constraint if exists assets_year_month_key;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.assets'::regclass
      and conname = 'assets_user_year_month_key'
  ) then
    alter table public.assets
      add constraint assets_user_year_month_key unique (user_id, year, month);
  end if;

  alter table public.health_weight_logs drop constraint if exists health_weight_logs_pkey;
  alter table public.health_weight_logs
    add constraint health_weight_logs_pkey primary key (user_id, log_date);

  execute 'alter table public.app_user_profiles enable row level security';
  execute 'drop policy if exists app_user_profiles_select_own on public.app_user_profiles';
  execute 'create policy app_user_profiles_select_own on public.app_user_profiles for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists app_user_profiles_insert_own on public.app_user_profiles';
  execute 'create policy app_user_profiles_insert_own on public.app_user_profiles for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists app_user_profiles_update_own on public.app_user_profiles';
  execute 'create policy app_user_profiles_update_own on public.app_user_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists app_user_profiles_delete_own on public.app_user_profiles';
  execute 'create policy app_user_profiles_delete_own on public.app_user_profiles for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.transactions enable row level security';
  execute 'drop policy if exists transactions_select_own on public.transactions';
  execute 'create policy transactions_select_own on public.transactions for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists transactions_insert_own on public.transactions';
  execute 'create policy transactions_insert_own on public.transactions for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists transactions_update_own on public.transactions';
  execute 'create policy transactions_update_own on public.transactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists transactions_delete_own on public.transactions';
  execute 'create policy transactions_delete_own on public.transactions for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.assets enable row level security';
  execute 'drop policy if exists assets_select_own on public.assets';
  execute 'create policy assets_select_own on public.assets for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists assets_insert_own on public.assets';
  execute 'create policy assets_insert_own on public.assets for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists assets_update_own on public.assets';
  execute 'create policy assets_update_own on public.assets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists assets_delete_own on public.assets';
  execute 'create policy assets_delete_own on public.assets for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.portfolios enable row level security';
  execute 'drop policy if exists portfolios_select_own on public.portfolios';
  execute 'create policy portfolios_select_own on public.portfolios for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists portfolios_insert_own on public.portfolios';
  execute 'create policy portfolios_insert_own on public.portfolios for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists portfolios_update_own on public.portfolios';
  execute 'create policy portfolios_update_own on public.portfolios for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists portfolios_delete_own on public.portfolios';
  execute 'create policy portfolios_delete_own on public.portfolios for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.cards enable row level security';
  execute 'drop policy if exists cards_select_own on public.cards';
  execute 'create policy cards_select_own on public.cards for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists cards_insert_own on public.cards';
  execute 'create policy cards_insert_own on public.cards for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists cards_update_own on public.cards';
  execute 'create policy cards_update_own on public.cards for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists cards_delete_own on public.cards';
  execute 'create policy cards_delete_own on public.cards for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.insurances enable row level security';
  execute 'drop policy if exists insurances_select_own on public.insurances';
  execute 'create policy insurances_select_own on public.insurances for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists insurances_insert_own on public.insurances';
  execute 'create policy insurances_insert_own on public.insurances for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists insurances_update_own on public.insurances';
  execute 'create policy insurances_update_own on public.insurances for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists insurances_delete_own on public.insurances';
  execute 'create policy insurances_delete_own on public.insurances for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.health_weight_logs enable row level security';
  execute 'drop policy if exists health_weight_logs_select_own on public.health_weight_logs';
  execute 'create policy health_weight_logs_select_own on public.health_weight_logs for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists health_weight_logs_insert_own on public.health_weight_logs';
  execute 'create policy health_weight_logs_insert_own on public.health_weight_logs for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists health_weight_logs_update_own on public.health_weight_logs';
  execute 'create policy health_weight_logs_update_own on public.health_weight_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists health_weight_logs_delete_own on public.health_weight_logs';
  execute 'create policy health_weight_logs_delete_own on public.health_weight_logs for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.quant_rebalance_signals enable row level security';
  execute 'drop policy if exists quant_rebalance_signals_select_own on public.quant_rebalance_signals';
  execute 'create policy quant_rebalance_signals_select_own on public.quant_rebalance_signals for select to authenticated using (auth.uid() = user_id)';
  execute 'drop policy if exists quant_rebalance_signals_insert_own on public.quant_rebalance_signals';
  execute 'create policy quant_rebalance_signals_insert_own on public.quant_rebalance_signals for insert to authenticated with check (auth.uid() = user_id)';
  execute 'drop policy if exists quant_rebalance_signals_update_own on public.quant_rebalance_signals';
  execute 'create policy quant_rebalance_signals_update_own on public.quant_rebalance_signals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'drop policy if exists quant_rebalance_signals_delete_own on public.quant_rebalance_signals';
  execute 'create policy quant_rebalance_signals_delete_own on public.quant_rebalance_signals for delete to authenticated using (auth.uid() = user_id)';

  execute 'alter table public.quant_strategy_rules enable row level security';
  execute 'drop policy if exists quant_strategy_rules_select_authenticated on public.quant_strategy_rules';
  execute 'create policy quant_strategy_rules_select_authenticated on public.quant_strategy_rules for select to authenticated using (true)';

  execute 'alter table public.portfolio_market_prices enable row level security';
  execute 'drop policy if exists portfolio_market_prices_select_authenticated on public.portfolio_market_prices';
  execute 'create policy portfolio_market_prices_select_authenticated on public.portfolio_market_prices for select to authenticated using (true)';

  execute 'alter table public.portfolio_price_history enable row level security';
  execute 'drop policy if exists portfolio_price_history_select_authenticated on public.portfolio_price_history';
  execute 'create policy portfolio_price_history_select_authenticated on public.portfolio_price_history for select to authenticated using (true)';

  return jsonb_build_object(
    'dryRun', false,
    'readyToFinalize', true,
    'rlsEnabled', true,
    'counts', v_counts
  );
end;
$$;

revoke all on function public.finalize_netvisualizer_auth_rls(boolean) from public;
revoke all on function public.finalize_netvisualizer_auth_rls(boolean) from anon;
revoke all on function public.finalize_netvisualizer_auth_rls(boolean) from authenticated;
grant execute on function public.finalize_netvisualizer_auth_rls(boolean) to service_role;
