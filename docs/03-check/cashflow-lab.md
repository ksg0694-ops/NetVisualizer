# Cashflow Lab — Check

2026-09-15: full `npm run check` passed (21 behavior tests, five new Lab tests). Reconciled annual income-consumption-repayments=ledger surplus, accounting-year membership, current-to-date clipping, null missing periods, stable cumulative median, additive category means including Other, income independence, period-filter scope, and navigation/refresh integration.

Rendered four charts using clearly labeled synthetic data in local-only `outputs/cashflow-lab-preview.html` (not committed). Inspected annual bars, cumulative lines and category bars at desktop and 390px viewport (375px content with scrollbar; scrollWidth equals clientWidth). Checked report-mode layout, period change to February (insufficient baseline), return to current, and visible summaries. No console errors observed. Actual unauthenticated app direct-link navigation and old-view comparison work; no fabricated marks in empty charts.

Limitations: no authenticated private ledger inspected; inputs at runtime remain user's existing account data. Print styling supplied but actual PDF pagination/output not verified. Browser-visible source tables are aggregate rows; no raw financial records exported. No confidence interval or budget target inferred. Previous cashflow source/UI files unchanged by this Lab task.

Check gate: local tests and visual acceptance passed. Pending publication checks tracked in report.
