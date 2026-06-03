# Quant Engine Progress

Last updated: 2026-06-04

## Goal

Build a personal fintech app feature set that commercial apps do not provide, starting with portfolio classification, Quant strategy metadata, and free-only market price synchronization.

## Current Status

| Area | Status | Notes |
| --- | --- | --- |
| Branch | In progress | `codex/quant-engine` |
| Asset classification | Done | Portfolio metadata columns and ordering are implemented. |
| Quant metadata | Done | `strategy_tag` and `avg_buy_price` are stored in `portfolios`. |
| Ticker backfill | Done | 23 stock/ETF rows now have inferred tickers; obvious brokerage cash rows were reclassified to cash. |
| Strategy rules | Done | `quant_strategy_rules` stores target weights, bands, and triggers. |
| Manual price input | Done | Latest prices and history are saved. |
| Price history | Done | `portfolio_price_history` exists in Supabase. |
| Rebalance signals | Done | `quant_rebalance_signals` stores strategy-level rebalance snapshots from the investment detail view. |
| Edge Function | Done | `sync-market-prices` is deployed and active. |
| Free-only safety | Done | Default provider is `disabled`; paid-market override is removed. |
| KIS provider code | Done | Domestic short-code current quote only; no account/order endpoints. |
| App sync status | Done | Investment detail view shows free mode, ticker count, price cache count, and KIS key pending status. |
| KIS helper scripts | Done | `set-kis-secrets.ps1` and `kis-dry-run.ps1` are available. |
| KIS real dry-run | Blocked | Needs `KIS_APP_KEY` and `KIS_APP_SECRET`. |

## Stage Progress

| Stage | Description | Status |
| --- | --- | --- |
| 1 | Data foundation: portfolio classification and Quant columns | Done |
| 2 | Strategy rules and rebalance structure | Done |
| 3 | Manual market price and price history | Done |
| 4 | Server-side quote cache scaffold | Done |
| 5 | Free-only provider policy | Done |
| 6 | KIS domestic quote provider | Ready, waiting for secrets |
| 7 | UI status and helper scripts | Done |
| 8 | Rebalance signal snapshots | Done |
| 9 | Portfolio ticker backfill | Done |
| 10 | Dry-run with real KIS credentials | Blocked |
| 11 | Scheduled sync | Deferred |

## Safety Rules

- External provider is disabled by default.
- There is no paid-market-data override.
- Korean market data through Twelve Data is always blocked.
- KIS provider accepts only domestic short-code tickers, including numeric codes such as `005930` and alphanumeric ETF codes such as `0098N0`.
- KIS provider does not call account, balance, order, trade, or execution APIs.
- API tokens are not stored in the database.
- Automatic scheduled sync is not enabled.

## Next Actions

1. In the investment detail view, click `신호` after reviewing target weights and confirm rows are inserted into `quant_rebalance_signals`.
2. When KIS secrets are available, set remote secrets:

```powershell
.\scripts\set-kis-secrets.ps1
```

3. Run:

```powershell
.\scripts\kis-dry-run.ps1 -Tickers 005930
```

## Known Security Advisory

Supabase still reports RLS disabled on public tables. This is intentionally not changed yet because enabling RLS without policies would block current app access.
