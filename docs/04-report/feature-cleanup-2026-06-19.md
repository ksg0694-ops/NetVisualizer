# Feature Cleanup Report - 2026-06-19

## Goal

Prepare NetVisualizer for the next finance-analysis feature phase by cleaning up runtime behavior and making the current finance/Quant schema easier to reproduce.

No new finance-analysis feature was added in this pass.

## Changes

- Reused a single Supabase browser client from `getSupabaseClient()` instead of creating a new client on every read/write call.
- Centralized Supabase table query builders in `js/features/appCore.js`.
- Kept optional feature-table failures non-fatal and prevented failed optional fetches from overwriting the existing local cache with empty arrays.
- Split default startup tables from reserved real-estate detail tables so initial load only fetches data used by the current UI.
- Fixed the Portfolio -> Investment Detail click order so the strategy doughnut chart renders after the detail view is visible.
- Bumped the PWA service-worker cache name plus `appCore.js` and `portfolioViews.js` script versions so browsers pick up the cleanup.
- Added `supabase/migrations/20260619072000_create_base_finance_tables.sql` to document the base finance-table contract for fresh environments.
- Added `supabase/migrations/20260619073000_consolidate_finance_quant_schema.sql` to collect portfolio metadata, Quant rules, latest market prices, price history, and rebalance-signal tables into the real migration ledger.

## Browser Smoke Coverage

Verified locally at `http://127.0.0.1:8080`.

| Area | Result |
| --- | --- |
| Initial dashboard load | Pass |
| Supabase data sync status | Pass |
| Portfolio view | Pass |
| Investment detail strategy chart | Pass |
| Cash-flow view | Pass |
| Long-term asset view | Pass |
| Real-estate map/cards | Pass |
| Life cockpit | Pass |
| Weekly timetable | Pass |
| Vacation plan | Pass |
| Transaction modal open/close | Pass |
| Import modal open/close | Pass |
| Portfolio edit modal open/close | Pass |

## Observations

- The previous browser warning about multiple Supabase `GoTrueClient` instances disappeared after the singleton client cleanup.
- The remaining browser warning is Tailwind CDN's production warning. This is expected for the current static GitHub Pages setup and can be handled later if the project adopts a build step.
- RLS remains intentionally unchanged. Do not enable external financial provider sync before Auth/RLS policy design is finished.
- The new finance/Quant migration assumes the base finance tables already exist. The preceding `20260619072000_create_base_finance_tables.sql` migration now documents that base contract for fresh environments.

## Suggested Next Cleanup

1. Move finance constants such as payday rules, target asset, housing target, expected loan, and DSR assumptions into settings data.
2. Convert the legacy 2D array cache shape to object-based rows after the current modular version stays stable.
3. Replace inline `onclick` handlers with event-bound controls in feature modules.
4. Design Auth/RLS policies before enabling broader provider sync or public sharing.
5. Add a small repeatable smoke-test checklist or script for release checks.
