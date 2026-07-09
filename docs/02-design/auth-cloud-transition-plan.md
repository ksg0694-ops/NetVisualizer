# Auth Cloud Transition Plan

## Decision

NetVisualizer should move from a private/local personal app to a login-based cloud app before storing or syncing more sensitive personal data.

## Product Principle

The app remains personal-first. Login is not a social or team feature; it is a privacy boundary that lets the same product safely sync finance and health data across devices.

## Current Change

- Frontend now initializes Supabase Auth on app boot.
- Remote reads and writes require a signed-in session.
- Settings modal includes email magic-link login and logout controls.
- Existing local cache can still render while signed out.
- A non-destructive migration prepares `user_id` ownership columns but does not enable RLS yet.
- New Quant and manual market-price edits are stored in user-owned override tables layered over shared defaults/API caches.
- Owner backfill and RLS-finalize helpers are prepared as dry-run-first database functions.
- New Life to-do tasks are local-first in the frontend and have a user-owned RLS table, `life_todos`, for cloud sync.
- The live Supabase migration ledger has been synchronized through `20260710100000_create_life_todos.sql`.
- Legacy finance table timestamp compatibility was added in `20260710110000_add_legacy_finance_timestamps.sql`.
- Existing personal rows were assigned to the single Supabase Auth owner account, and owner-only RLS has been finalized for legacy personal tables.
- Life to-dos now support detailed notes, nested steps, and `career` / `finance` / `life` task domains.

## Staged Rollout

### Stage 1 - Auth Gate

- Require login before remote Supabase reads and writes.
- Keep local cache readable while signed out.
- Add email magic-link sign-in.
- Keep existing anon publishable key, but stop using it for data access while signed out.

### Stage 2 - Ownership Preparation

- Add nullable `user_id` columns with `auth.uid()` defaults for personal legacy tables.
- Add indexes on `(user_id, primary business dimension)`.
- Do not enable RLS yet for legacy tables.
- Do not drop existing global unique constraints yet.
- Create new override tables with RLS from day one because they have no legacy rows.

### Stage 3 - Legacy Data Backfill

- Identify the owner Supabase Auth user id.
- Backfill all existing personal rows to that owner.
- Copy existing shared Quant strategy rows into the owner's override rows.
- Copy existing manual/imported market prices into the owner's override rows.
- Verify zero `user_id is null` rows remain in personal tables.

Status: complete for `ksg0694@naver.com` / `869e1e98-eac8-499c-a0f1-bd2424dfdfb1`.

### Stage 4 - Constraint Conversion

Some existing tables use global keys that block multi-user cloud use:

- `assets`: `unique(year, month)` must become per-user uniqueness.
- `health_weight_logs`: `log_date` primary key must become per-user uniqueness.

These should be converted only after backfill.

`quant_strategy_rules` stays a shared default table. User changes live in `quant_strategy_rule_overrides`.

Prepared helper:

```sql
select public.finalize_netvisualizer_auth_rls();
select public.finalize_netvisualizer_auth_rls(false);
```

### Stage 5 - RLS Enforcement

Enable RLS only after Stage 3 and Stage 4 are complete.

Status: complete for the current live project. A signed-in browser smoke test is still needed.

Policy shape for personal tables:

- `select`: `auth.uid() = user_id`
- `insert`: `auth.uid() = user_id`
- `update`: `auth.uid() = user_id`
- `delete`: `auth.uid() = user_id`

Reference/global data remains separate:

- `real_estate_*`: global reference data, writable only by service-role sync.
- `portfolio_market_prices` and `portfolio_price_history`: shared API-backed market data cache.
- `portfolio_market_price_overrides`: latest user-owned manual/imported prices.
- `portfolio_market_price_override_history`: user-owned historical manual/imported prices.
- `quant_strategy_rule_overrides`: user-specific editable strategy settings.
- `life_todos`: user-owned Life to-do items with RLS from day one, plus detailed notes, nested steps, and Career/Finance/Life domains.

## Resolved Product Decisions

- Quant strategy rules use global defaults with optional user-specific overrides.
- Manually entered market prices are user-owned overrides; API prices remain a shared cache.
- Weekly Timetable and Vacation Plan are removed from the active app surface until they are redesigned.
- Existing legacy data is migrated to a chosen owner account via `backfill_netvisualizer_owner_data(...)`, not claimed implicitly by first login.

## Open Product Questions

1. Should real-estate subscription rows remain shared reference data, or should they become a private user watchlist?
