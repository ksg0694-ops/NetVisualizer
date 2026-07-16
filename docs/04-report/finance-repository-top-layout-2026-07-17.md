# FinanceRepository and CFO Top Layout Report

Date: 2026-07-17
Feature: FinanceRepository v1 + CFO Network top alignment

## Delivered

- Moved Supabase finance table definitions, selected columns, read queries, optional-table handling, and row normalization into `js/features/financeRepository.js`.
- Changed the finance cache for transactions, assets, and portfolios to object rows while preserving automatic migration from the previous two-dimensional cache.
- Added `getFinanceDataSnapshot()` and `getFinanceAccountingPeriods()` as read-only runtime contracts.
- Changed Finance Home and Personal CFO calculations to prefer repository portfolio rows instead of `dynamicPortfolioData`.
- Kept the old two-dimensional portfolio format only as an adapter for the existing edit modal.
- Top-aligned the first node in every CFO graph column at `y=92` and reduced unused vertical space in the balance-sheet graph.

## Verification

- Full `npm.cmd run check` passes, including the new repository contract test.
- Desktop browser: balance sheet, cash flow, and strategy graphs all start on the same top line.
- Live Supabase data remains visible: portfolio 39 items, liability 1 item, net worth 235 million KRW display.
- Mobile 390x844: no horizontal overflow; the compact summary remains visible instead of the SVG graph.

## Remaining

1. Replace the portfolio editor's indexed row draft with an object draft.
2. Move finance write operations into repository commands with focused refresh results.
3. Split payday accounting-period rules into a typed domain module.
