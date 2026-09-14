# Income / spending separation — Design

Sources: `getCashFlowPeriods()` (repository periods with valid confirmed close overlays); `isRepaymentExpense()` controls consumption categories. Retain absolute expense semantics, including positive expense records; refunds require correct existing ledger classification and are not inferred from amount sign.

For selected period, cap observation at today in local date. Exclude future/out-of-period transactions. Compare the first N inclusive days against up to six preceding nonoverlapping ended periods long enough to contain N days; exclude stale close records and empty unconfirmed periods. Empty confirmed periods mean known zero. Require three eligible periods for a comparison, with no fabricated data for missing months. Median reduces one-off distortion. List comparison periods, their values, dates and confirmation status for auditability. Unconfirmed nonempty history is provisional, not evidence of complete ingestion.

Show income separately (recorded-to-date total; previous ended-period total median/min/max explicitly not a pacing comparison). Spending: recorded-to-date, historical same-day median, difference, and fixed/other composition. Historical comparison is descriptive, not a safe spending limit. No income-derived percentages. Keep combined cash balance/allocation in secondary details, existing category panels and historical cashflow chart available.

Security / maintenance: pure JS model and textContent renderer, no new storage/API, shared repayment classifier injected into model, no HTML interpolation of financial labels. Test income independence, dates, insufficient history, zero baseline, exclusions, classified repayments/transfers, signed income, absolute expenses and future transactions. Validate full suite and mobile/desktop synthetic rendering before publication.

Design gate: approved user scope; no additional budget source exists, so budget controls/targets deferred.
