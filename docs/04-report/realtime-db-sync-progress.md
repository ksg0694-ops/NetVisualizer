# Realtime DB Sync Progress

Last updated: 2026-06-05

## Goal

Reduce manual Supabase edits by introducing a safe import/sync path for transactions, portfolio balances, and eventually official read-only financial APIs.

## Current Branch

`codex/realtime-db-sync`

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Branch isolation | Done | Work is separated from `main`. |
| Provider feasibility | Done | KFTC Open Banking/OpenAPI, MyData integrated auth, and KIS Open API were reviewed as official candidates. |
| Security boundary | Done | No browser-stored financial secrets, no raw account numbers, no unofficial scraping. |
| Schema draft | Done | Draft tables for sync sources, sync runs, and transaction import candidates. |
| Remote DB migration | Not started | SQL is intentionally not applied yet. |
| Import UI | Done | Browser CSV/TSV preview, validation, duplicate filtering, and confirmed insert into `transactions`. |
| Official API integration | Deferred | Requires consent/auth/provider setup and RLS policy review. |

## Stage Progress

| Stage | Description | Status |
| --- | --- | --- |
| 1 | Feasibility and provider boundary | Done |
| 2 | Import/sync schema draft | Done |
| 3 | CSV/TSV import parser and preview | Done |
| 4 | Confirmed import into `transactions` | Done |
| 5 | Sync run audit UI | Pending |
| 6 | Read-only official API dry-run | Deferred |
| 7 | Scheduled sync | Deferred |

## Implemented In This Branch

- Added a transaction import entry point in the cash-flow tab and transaction detail view.
- Added a CSV/TSV import modal with file selection, default payment method, summary counts, and preview table.
- Normalizes common Korean/English transaction columns: date, time, type, category, subcategory, memo, amount, withdrawal, deposit, payment amount, currency, and method.
- Infers income/expense/transfer and normalizes signs before saving.
- Filters duplicates against already loaded transactions and duplicates within the selected file.
- Inserts only `ready` rows into Supabase `transactions`, then merges the returned rows into the local cache and refreshes the current dashboard.

## Safety Rules

- Do not store bank passwords, OTP, certificates, app secrets, or access tokens in browser storage.
- Do not store raw account numbers in normal application tables.
- Do not use screen scraping or automatic login.
- Do not call transfer, order, trade, or execution APIs.
- Do not enable scheduled sync before manual import is stable.
- Do not apply remote schema changes until RLS/Auth implications are reviewed.

## Next Actions

1. Manually test the import flow with one small bank/card CSV export.
2. Decide whether to apply the draft staging/audit SQL or keep the current no-new-table browser import path.
3. Add a sync run audit UI only after the import flow is stable.
4. Only after that, decide whether KFTC Open Banking or another official provider is worth a read-only PoC.

## Known Security Advisory

Supabase currently reports RLS disabled on public tables. This is still intentionally not auto-remediated because enabling RLS without policies would break the current SPA. Realtime sync increases the sensitivity of stored data, so RLS/Auth must be solved before any official API token or scheduled sync flow is enabled.
