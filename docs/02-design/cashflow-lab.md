# Cashflow Lab — design and metric contract

Historical note: comparison eligibility, lookback, separate annual panels and pace axes are superseded by `cashflow-comparability.md` (2026-09-15 user correction).

Source: getCashFlowPeriods(), including confirmed monthly-close overlays, within existing session account; re-render after shared finance refresh. No raw financial snapshot committed. New files isolate pure aggregation and UI; old analysis sources and UI remain intact.

2026 means accounting periods whose key begins 2026, respecting inclusive payday boundaries. Transactions after local today or outside their period are excluded. Empty unconfirmed/future periods remain null, not zero. Closed-empty periods may be zero. Source tables show dates, count, latest record and close status. A nonempty record is provisional unless confirmed; no claim of full import coverage.

Income = signed income rows. Expense = absolute expense rows, preserving legacy refund semantics. Repayment uses existing isRepaymentExpense; consumption = expense minus repayments. Ledger surplus = income minus all expense; saving/transfer rows excluded, so it is NOT bank balance or spendable cash. Savings already represented as expenses follow the existing ledger classification; no inferred transfer matching.

Current-period pace inherits SpendingAnalysis eligibility: maximum six ended prior periods, minimum three for baseline, stale/empty-unconfirmed excluded, enough days for the selected observed day. A fixed cohort is used at every daily point. Median of cumulative sums is shown only through observed day. Category comparator is arithmetic mean over that exact cohort and same days, visibly labeled; use top six union categories plus additive Other.

Interaction contract: 2026 annual section is fixed, period control affects current-period charts and report bullets only; annual bar click selects that period. Current button selects period containing today or clearly labeled latest available. Report mode reuses data/visuals and offers user-triggered print, not a separate stale report. Comparison button navigates to old cashflow. Navigation supported desktop/mobile, active-only refresh, persisted view allowlist, no hidden-view rendering.

Check plan: synthetic date bounds, 2026 scope, missing/future periods, sums/reconciliation, category mean, stable cumulative median cohort, no income influence; browser nonempty/empty, period change, report/dashboard switching, old view, narrow width, print CSS. No health/affordability thresholds or causal stories.

Design gate: begin implementation. Data dashboard/visualization principles adapted to user-selected NetVisualizer runtime and privacy boundary; shared standalone snapshot/hosting workflow not applicable.
