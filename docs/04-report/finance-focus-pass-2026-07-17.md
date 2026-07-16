# Finance Focus Pass

Date: 2026-07-17  
Feature: Finance Focus Pass v1  
Status: implemented

## Product Decision

Finance remains the primary decision area. Life keeps its independent Todo and Health summary, but it no longer reads or routes Personal CFO projects. Authentication and broader Life-to-Finance integration remain deferred.

## Implemented

- Moved payday overrides and accounting-period boundary calculation from `appCore.js` to `src/features/finance/paydayAccounting.ts`.
- Added boundary tests for the day before payday and payday itself.
- Moved the Finance Home decision inbox above the asset chart.
- Added explicit severity ordering so deficit, stale data, high spending, debt, housing funding, and positive surplus appear in decision order.
- Marked Personal CFO KPIs and graph modes as actual data or planning model.
- Kept only the housing subscription and online master's projects, with next milestones, target timing, funding source, and funding gap.
- Removed Life dashboard dependencies on Personal CFO project snapshots.

## Data Semantics

| Area | Basis |
| --- | --- |
| Net worth, assets, liabilities | Actual portfolio snapshot |
| Closed free cash flow, fixed cost and repayment ratio | Latest closed payday period |
| Savings allocation, emergency coverage | Manual planning values |
| Projects and risk scores | Planning model |

## Quality Gate

- `npm run check`: passed
- TypeScript compile: passed
- Generated CFO runtime contract: passed
- UI, repository, domain, Supabase, and static asset contracts: passed

## Remaining Finance Work

1. Build a monthly CFO close screen for reviewing transaction classifications before KPI calculation.
2. Move plan values into a small settings model with an explicit effective date and change history.
3. Make multi-row portfolio saves atomic through a server-side transaction or RPC.
