# Personal balance sheet

## Plan
- Replace the portfolio landing view in place; retain existing editor and investment details.
- Five purpose groups, housing debt nested with gross assets and net amount. Three top KPIs.
- Reuse owner-scoped long-term `assets` history. Do not subtract debt again from its existing net-worth total.
- Read and reconcile the supplied private input sheet before importing any holdings. Never commit private amounts or source exports.
- Reuse authenticated market refresh; explicitly distinguish unavailable/stale prices and stored amounts.

## Design
- Compact white surface, 3 KPIs, grouped balances, monthly/yearly net-worth chart and an expandable monthly reconciliation.
- `netWorthChange = investmentPerformance + netSaving + otherChange + reconciliationDifference`.
- Investment performance means ending minus opening investment valuation minus net contributions, not raw balance growth. Investment and pension scope must be consistent.
- Historical totals alone support net-worth changes, not attribution. Missing flow evidence remains null, not zero or a forced balancing investment return.
- Calendar months for history/reconciliation; salary-cycle cash flow must not be silently joined by label. Principal repayments and internal transfers are not expenses in net-saving attribution.
- A monthly reconciliation contract records evidence dates, coverage, scope, contributions, other adjustments and review state. Only explicitly reviewed complete inputs yield attributed figures.
- No public hardcoded personal records, new public sheet permissions, destructive history replacement, or inferred historical prices.

## Gates
- Plan/design documented. bkit tools unavailable; existing project level is dynamic.
- Do: implement pure model, current valuation adapter and compact UI.
- Check: reconciliation boundary tests, full project checks, desktop/mobile browser verification.
- Report: state unconnected sources and incomplete attribution explicitly.

## Check / report (2026-09-24)
- Implemented and applied owner-protected input and monthly-flow schemas; preserved original portfolio/history rows.
- Verified imported snapshot count and net total against the source sheet using private database readback.
- Full `npm run check` passed (46 foundation tests plus repository, domain, static-assets and other project gates).
- Desktop/mobile synthetic screen and logged-out route inspected; see root `design-qa.md` for evidence and residual signed-in test gap.
- Existing authenticated quote function deployed with USD/KRW refresh. Live public USD/KRW payload verified; full signed-in invoke remains a device check.
- Initial sheet import is not ongoing sheet sync. Historical attribution remains uncomputed until monthly evidence is supplied.
