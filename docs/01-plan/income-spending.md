# Income / spending separation — Plan

Decision: help the owner see whether recorded consumption is higher than their own history, independently of volatile income. Destination is the existing NetVisualizer cashflow page, not a separate dashboard.

Primary measures: current consumption, median consumption over the same elapsed days of up to six previous ended accounting periods, and absolute/percentage difference. Income gets its own current total and historical full-period range; it is never a spending denominator. Keep payday periods, transaction import, detailed categories and reconciliation.

Guardrails: historical habits are not an affordable budget; never label a user as overspending. No invented budget, projection or financial recommendation. Show insufficient history, unconfirmed records and partial-period caveats. No database or personal-record writes.

Plan gate: source inspection confirms inclusive payday period boundaries, signed income and absolute expense convention, monthly-close overlays, and existing repayment classifier. Implement a small pure module with synthetic tests and a separate renderer.
