-- Helper for one-time migration of existing private NetVisualizer data to an
-- intended Supabase Auth owner.
--
-- Default execution is dry-run only:
--   select public.backfill_netvisualizer_owner_data('<OWNER_USER_ID>'::uuid);
--
-- Actual write:
--   select public.backfill_netvisualizer_owner_data('<OWNER_USER_ID>'::uuid, false);
--
-- Keep this helper restricted. It is for SQL-editor/service-role use, not app UI.

create or replace function public.backfill_netvisualizer_owner_data(
  p_owner_user_id uuid,
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
  v_user_email text;
begin
  if p_owner_user_id is null then
    raise exception 'owner user id is required';
  end if;

  select email
    into v_user_email
  from auth.users
  where id = p_owner_user_id;

  if v_user_email is null then
    raise exception 'auth user % was not found', p_owner_user_id;
  end if;

  select count(*) into v_count from public.transactions where user_id is null;
  v_counts := v_counts || jsonb_build_object('transactions_null_user_id', v_count);
  if not p_dry_run then
    update public.transactions set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('transactions_updated', v_count);
  end if;

  select count(*) into v_count from public.assets where user_id is null;
  v_counts := v_counts || jsonb_build_object('assets_null_user_id', v_count);
  if not p_dry_run then
    update public.assets set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('assets_updated', v_count);
  end if;

  select count(*) into v_count from public.portfolios where user_id is null;
  v_counts := v_counts || jsonb_build_object('portfolios_null_user_id', v_count);
  if not p_dry_run then
    update public.portfolios set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('portfolios_updated', v_count);
  end if;

  select count(*) into v_count from public.cards where user_id is null;
  v_counts := v_counts || jsonb_build_object('cards_null_user_id', v_count);
  if not p_dry_run then
    update public.cards set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('cards_updated', v_count);
  end if;

  select count(*) into v_count from public.insurances where user_id is null;
  v_counts := v_counts || jsonb_build_object('insurances_null_user_id', v_count);
  if not p_dry_run then
    update public.insurances set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('insurances_updated', v_count);
  end if;

  select count(*) into v_count from public.health_weight_logs where user_id is null;
  v_counts := v_counts || jsonb_build_object('health_weight_logs_null_user_id', v_count);
  if not p_dry_run then
    update public.health_weight_logs set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('health_weight_logs_updated', v_count);
  end if;

  select count(*) into v_count from public.quant_rebalance_signals where user_id is null;
  v_counts := v_counts || jsonb_build_object('quant_rebalance_signals_null_user_id', v_count);
  if not p_dry_run then
    update public.quant_rebalance_signals set user_id = p_owner_user_id where user_id is null;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('quant_rebalance_signals_updated', v_count);
  end if;

  select count(*) into v_count from public.quant_strategy_rules;
  v_counts := v_counts || jsonb_build_object('quant_strategy_rules_to_override', v_count);
  if not p_dry_run then
    insert into public.quant_strategy_rule_overrides (
      user_id,
      strategy_tag,
      target_pct,
      band_pct,
      trigger_label,
      is_active,
      display_order,
      updated_at
    )
    select
      p_owner_user_id,
      strategy_tag,
      target_pct,
      band_pct,
      trigger_label,
      is_active,
      display_order,
      coalesce(updated_at, now())
    from public.quant_strategy_rules
    on conflict (user_id, strategy_tag) do update set
      target_pct = excluded.target_pct,
      band_pct = excluded.band_pct,
      trigger_label = excluded.trigger_label,
      is_active = excluded.is_active,
      display_order = excluded.display_order,
      updated_at = excluded.updated_at;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('quant_strategy_rule_overrides_upserted', v_count);
  end if;

  select count(*) into v_count
  from public.portfolio_market_prices
  where source in ('manual', 'import');
  v_counts := v_counts || jsonb_build_object('manual_market_prices_to_override', v_count);
  if not p_dry_run then
    insert into public.portfolio_market_price_overrides (
      user_id,
      ticker,
      price,
      currency,
      price_date,
      source,
      note,
      updated_at
    )
    select
      p_owner_user_id,
      ticker,
      price,
      currency,
      price_date,
      source,
      note,
      coalesce(updated_at, now())
    from public.portfolio_market_prices
    where source in ('manual', 'import')
    on conflict (user_id, ticker) do update set
      price = excluded.price,
      currency = excluded.currency,
      price_date = excluded.price_date,
      source = excluded.source,
      note = excluded.note,
      updated_at = excluded.updated_at;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('market_price_overrides_upserted', v_count);
  end if;

  select count(*) into v_count
  from public.portfolio_price_history
  where source in ('manual', 'import');
  v_counts := v_counts || jsonb_build_object('manual_price_history_to_override', v_count);
  if not p_dry_run then
    insert into public.portfolio_market_price_override_history (
      user_id,
      ticker,
      price,
      currency,
      price_date,
      source,
      note,
      created_at
    )
    select
      p_owner_user_id,
      ticker,
      price,
      currency,
      price_date,
      source,
      note,
      coalesce(created_at, now())
    from public.portfolio_price_history
    where source in ('manual', 'import')
    on conflict (user_id, ticker, price_date, source) do update set
      price = excluded.price,
      currency = excluded.currency,
      note = excluded.note;
    get diagnostics v_count = row_count;
    v_counts := v_counts || jsonb_build_object('market_price_override_history_upserted', v_count);
  end if;

  if not p_dry_run then
    insert into public.app_user_profiles (user_id, email)
    values (p_owner_user_id, v_user_email)
    on conflict (user_id) do update set
      email = excluded.email,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'dryRun', p_dry_run,
    'ownerUserId', p_owner_user_id,
    'ownerEmail', v_user_email,
    'counts', v_counts
  );
end;
$$;

revoke all on function public.backfill_netvisualizer_owner_data(uuid, boolean) from public;
revoke all on function public.backfill_netvisualizer_owner_data(uuid, boolean) from anon;
revoke all on function public.backfill_netvisualizer_owner_data(uuid, boolean) from authenticated;
grant execute on function public.backfill_netvisualizer_owner_data(uuid, boolean) to service_role;
