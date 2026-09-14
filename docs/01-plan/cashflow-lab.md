# Cashflow Lab — zero-base visual plan

User-approved destination: a NEW tab inside NetVisualizer, keeping the existing cashflow and monthly report unchanged for A/B comparison. Not a new Codex task or replacement of the old screen.

Questions / visual plan:
1. What happened in 2026? Income and consumption grouped monthly bars on a common zero-based won scale; signed income-minus-expense bars show cash movement separately. Four compact toplines: income, consumption, repayments, ledger surplus. Accounting-year periods, not calendar-year transaction dates; visible scope.
2. Is current consumption faster than usual? Cumulative daily consumption vs same-day prior-period median; no income denominator, no forecast. Period selector defaults to the period containing today, with return-to-current control. Missing history leaves comparator absent rather than invented zero.
3. Where is spending concentrated/changed? Horizontal category bars of current spending and eligible prior same-day average. Label the different comparator explicitly; category means are additive, medians are not.
4. What should the reader retain? A concise report mode reuses the same charts and source model, adds three factual metric-backed observations and print styling. No causal claims or budget invented.

Visual hierarchy: short title/controls → four numbers → annual charts → current-period pace + category comparison → collapsible source/method records. Blue income, orange consumption, neutral comparator, signed labels. Responsive single-column at narrow width; data tables provide exact values and accessible chart alternatives. Old-view switch remains visible.

Plan gate: scope is read-only financial analysis in existing authenticated app. No private data embedded in public GitHub assets. No new service, DB migration, separate hosting, subscriptions or account scopes. Use existing app chart runtime and shell rather than a separate Data starter: the user explicitly selected the existing app as destination; preserve authentication and runtime data flow.
