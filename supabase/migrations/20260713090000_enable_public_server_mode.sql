-- Keep the GitHub Pages app usable without Supabase Auth while still pointing
-- anonymous writes at the existing single-user NetVisualizer dataset.

create or replace function public.netvisualizer_public_owner_id()
returns uuid
language sql
stable
as $$
  select '869e1e98-eac8-499c-a0f1-bd2424dfdfb1'::uuid;
$$;

grant execute on function public.netvisualizer_public_owner_id() to anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'transactions',
    'assets',
    'portfolios',
    'cards',
    'insurances',
    'health_weight_logs',
    'quant_rebalance_signals',
    'life_todos',
    'quant_strategy_rule_overrides',
    'portfolio_market_price_overrides',
    'portfolio_market_price_override_history'
  ]
  loop
    execute format(
      'alter table public.%I alter column user_id set default coalesce(auth.uid(), public.netvisualizer_public_owner_id())',
      table_name
    );
  end loop;
end $$;

drop policy if exists transactions_public_server_select on public.transactions;
create policy transactions_public_server_select
on public.transactions for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists transactions_public_server_insert on public.transactions;
create policy transactions_public_server_insert
on public.transactions for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists transactions_public_server_update on public.transactions;
create policy transactions_public_server_update
on public.transactions for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists transactions_public_server_delete on public.transactions;
create policy transactions_public_server_delete
on public.transactions for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists assets_public_server_select on public.assets;
create policy assets_public_server_select
on public.assets for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists assets_public_server_insert on public.assets;
create policy assets_public_server_insert
on public.assets for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists assets_public_server_update on public.assets;
create policy assets_public_server_update
on public.assets for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists assets_public_server_delete on public.assets;
create policy assets_public_server_delete
on public.assets for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolios_public_server_select on public.portfolios;
create policy portfolios_public_server_select
on public.portfolios for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolios_public_server_insert on public.portfolios;
create policy portfolios_public_server_insert
on public.portfolios for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolios_public_server_update on public.portfolios;
create policy portfolios_public_server_update
on public.portfolios for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolios_public_server_delete on public.portfolios;
create policy portfolios_public_server_delete
on public.portfolios for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists cards_public_server_select on public.cards;
create policy cards_public_server_select
on public.cards for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists cards_public_server_insert on public.cards;
create policy cards_public_server_insert
on public.cards for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists cards_public_server_update on public.cards;
create policy cards_public_server_update
on public.cards for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists cards_public_server_delete on public.cards;
create policy cards_public_server_delete
on public.cards for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists insurances_public_server_select on public.insurances;
create policy insurances_public_server_select
on public.insurances for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists insurances_public_server_insert on public.insurances;
create policy insurances_public_server_insert
on public.insurances for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists insurances_public_server_update on public.insurances;
create policy insurances_public_server_update
on public.insurances for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists insurances_public_server_delete on public.insurances;
create policy insurances_public_server_delete
on public.insurances for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists health_weight_logs_public_server_select on public.health_weight_logs;
create policy health_weight_logs_public_server_select
on public.health_weight_logs for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists health_weight_logs_public_server_insert on public.health_weight_logs;
create policy health_weight_logs_public_server_insert
on public.health_weight_logs for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists health_weight_logs_public_server_update on public.health_weight_logs;
create policy health_weight_logs_public_server_update
on public.health_weight_logs for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists health_weight_logs_public_server_delete on public.health_weight_logs;
create policy health_weight_logs_public_server_delete
on public.health_weight_logs for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_rebalance_signals_public_server_select on public.quant_rebalance_signals;
create policy quant_rebalance_signals_public_server_select
on public.quant_rebalance_signals for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_rebalance_signals_public_server_insert on public.quant_rebalance_signals;
create policy quant_rebalance_signals_public_server_insert
on public.quant_rebalance_signals for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_rebalance_signals_public_server_update on public.quant_rebalance_signals;
create policy quant_rebalance_signals_public_server_update
on public.quant_rebalance_signals for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_rebalance_signals_public_server_delete on public.quant_rebalance_signals;
create policy quant_rebalance_signals_public_server_delete
on public.quant_rebalance_signals for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_todos_public_server_select on public.life_todos;
create policy life_todos_public_server_select
on public.life_todos for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_todos_public_server_insert on public.life_todos;
create policy life_todos_public_server_insert
on public.life_todos for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_todos_public_server_update on public.life_todos;
create policy life_todos_public_server_update
on public.life_todos for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists life_todos_public_server_delete on public.life_todos;
create policy life_todos_public_server_delete
on public.life_todos for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_public_server_select on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_public_server_select
on public.quant_strategy_rule_overrides for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_public_server_insert on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_public_server_insert
on public.quant_strategy_rule_overrides for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_public_server_update on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_public_server_update
on public.quant_strategy_rule_overrides for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_strategy_rule_overrides_public_server_delete on public.quant_strategy_rule_overrides;
create policy quant_strategy_rule_overrides_public_server_delete
on public.quant_strategy_rule_overrides for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_public_server_select on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_public_server_select
on public.portfolio_market_price_overrides for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_public_server_insert on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_public_server_insert
on public.portfolio_market_price_overrides for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_public_server_update on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_public_server_update
on public.portfolio_market_price_overrides for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_overrides_public_server_delete on public.portfolio_market_price_overrides;
create policy portfolio_market_price_overrides_public_server_delete
on public.portfolio_market_price_overrides for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_public_server_select on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_public_server_select
on public.portfolio_market_price_override_history for select to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_public_server_insert on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_public_server_insert
on public.portfolio_market_price_override_history for insert to anon, authenticated
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_public_server_update on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_public_server_update
on public.portfolio_market_price_override_history for update to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id)
with check (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists portfolio_market_price_override_history_public_server_delete on public.portfolio_market_price_override_history;
create policy portfolio_market_price_override_history_public_server_delete
on public.portfolio_market_price_override_history for delete to anon, authenticated
using (user_id = public.netvisualizer_public_owner_id() or auth.uid() = user_id);

drop policy if exists quant_strategy_rules_public_select on public.quant_strategy_rules;
create policy quant_strategy_rules_public_select
on public.quant_strategy_rules for select to anon, authenticated
using (true);

drop policy if exists portfolio_market_prices_public_select on public.portfolio_market_prices;
create policy portfolio_market_prices_public_select
on public.portfolio_market_prices for select to anon, authenticated
using (true);

drop policy if exists portfolio_price_history_public_select on public.portfolio_price_history;
create policy portfolio_price_history_public_select
on public.portfolio_price_history for select to anon, authenticated
using (true);

comment on function public.netvisualizer_public_owner_id() is
  'Owner id used by the public GitHub Pages single-user NetVisualizer mode.';
