# Cashflow comparability — Design

Extend pure SpendingAnalysis with opt-in policy parameters; defaults retain old view contracts. Lab opts into stale inclusion, 12-period lookback, one-sample minimum. Monthly close overlays retain existing validity rules: use latest effective source; no force-apply stale overrides or DB mutation.

Independent annual panels: orange spending bars with ended-period median; blue income bars with separate ended-period median. Different series scales explicitly labeled because the job is within-series comparison, not income/spending heights. Spending control switches total vs daily average (current observed elapsed days / prior full days). In-progress bars visually lightened and labeled *. Net chart moves to secondary evidence details.

Pace: Y axis min 0, maximum a rounded headroom value of all available period consumption through today, independent of selected period. Same data => same scale across month changes. X labels actual M/D, tooltip full date + elapsed days and fixed cohort count. Baseline at selected observed day equals model's summary median. No forecast, no padding missing history with zero. Full curve source table retains exact dates. Completed long periods can have fewer same-day comparators; explicit count and short-period exclusions instead of generic insufficient-data text.

Design gate: implement and check stale histories, long August (32 days), current September, date labels, shared scale, isolated income/spending charts and fixed annual filter scope. Read-only diagnostic may validate only availability/counts, not log private amounts.
