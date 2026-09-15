# Cashflow comparability — Check

Full npm run check passed (22 behavior tests). Added real payday-boundary regression: September observes 22/29 days, uses January–August despite changed closes; August observes 32 days and uses February/June, with shorter periods counted explicitly. Baseline available with one or two comparators. Legacy SpendingAnalysis defaults unchanged and original tests pass. Fixed Y maximum identical across month selections; actual date sequence, final date, and total/daily normalization verified.

Read-only authorized-source diagnostic reuses repository period builder, monthly-close normalization/validity logic and analysis model; only aggregate period eligibility printed, no private rows/amounts stored. Current server confirms September 8/8 prior periods; August 2/7 have enough days. No DB writes or fake close confirmations.

Synthetic browser: separate income and consumption bars with reference lines, daily toggle, August/September selection (same 0–2,000,000 synthetic scale), real M/D labels and full-date table, mobile at 390px viewport (375px content/scroll width; no horizontal overflow), no console errors. Endpoint dates and observed day remain visible. Last renderer change is tick-label selection only; focused tests rerun afterward and CI runs full suite.

Limitations: daily average is observed spend/elapsed days, not a forecast or budget. Same-day comparisons of longer completed periods naturally have fewer eligible histories, exposed in the UI. Stale close overrides are not forcibly applied; existing latest-effective-transaction policy remains authoritative.
