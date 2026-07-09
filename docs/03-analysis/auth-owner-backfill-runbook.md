# Auth Owner Backfill And RLS Finalize Runbook

Use this after applying the Auth ownership and override-table migrations.

## 1. Find Owner User

```sql
select id, email, created_at
from auth.users
order by created_at desc;
```

## 2. Dry Run

```sql
select public.backfill_netvisualizer_owner_data('<OWNER_USER_ID>'::uuid);
```

The default second argument is `true`, so this only reports counts.

## 3. Apply Backfill

```sql
select public.backfill_netvisualizer_owner_data('<OWNER_USER_ID>'::uuid, false);
```

This assigns legacy personal rows with `user_id is null` to the owner and copies current shared manual settings into user-owned override tables.

## 4. Verify

```sql
select 'transactions' as table_name, count(*) from public.transactions where user_id is null
union all select 'assets', count(*) from public.assets where user_id is null
union all select 'portfolios', count(*) from public.portfolios where user_id is null
union all select 'cards', count(*) from public.cards where user_id is null
union all select 'insurances', count(*) from public.insurances where user_id is null
union all select 'health_weight_logs', count(*) from public.health_weight_logs where user_id is null
union all select 'quant_rebalance_signals', count(*) from public.quant_rebalance_signals where user_id is null;
```

```sql
select count(*) as quant_rule_overrides
from public.quant_strategy_rule_overrides
where user_id = '<OWNER_USER_ID>'::uuid;

select count(*) as manual_price_overrides
from public.portfolio_market_price_overrides
where user_id = '<OWNER_USER_ID>'::uuid;

select count(*) as manual_price_override_history
from public.portfolio_market_price_override_history
where user_id = '<OWNER_USER_ID>'::uuid;
```

## Notes

- This does not delete manual/import rows from shared market tables.
- API rows remain shared cache data.

## 5. Dry Run RLS Finalize

Run this only after the owner backfill verification returns zero null `user_id` rows.

```sql
select public.finalize_netvisualizer_auth_rls();
```

The result should include `"readyToFinalize": true`.

## 6. Apply RLS Finalize

```sql
select public.finalize_netvisualizer_auth_rls(false);
```

This performs the final security switch:

- converts `assets` from global `unique(year, month)` to `unique(user_id, year, month)`
- converts `health_weight_logs` from global `primary key(log_date)` to `primary key(user_id, log_date)`
- makes personal-table `user_id` columns `not null`
- enables owner-only RLS for personal tables
- enables authenticated read-only RLS for shared Quant defaults and shared API market-price cache tables

## 7. Post-Finalize Checks

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'transactions',
    'assets',
    'portfolios',
    'cards',
    'insurances',
    'health_weight_logs',
    'quant_rebalance_signals',
    'quant_strategy_rule_overrides',
    'portfolio_market_price_overrides',
    'portfolio_market_price_override_history'
  )
order by tablename;
```

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'transactions',
    'assets',
    'portfolios',
    'cards',
    'insurances',
    'health_weight_logs',
    'quant_rebalance_signals'
  )
order by tablename, policyname;
```

## Remaining Product Decision

Real-estate subscription/reference tables are still treated as shared app data in this pass. If the saved real-estate list becomes a private watchlist, add a separate `user_id` ownership pass before enabling owner-only RLS there.
