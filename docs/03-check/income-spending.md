# Income / spending separation — Check

2026-09-15: full `npm run check` passed, including 16 foundation/behavior tests (six new consumption tests). Covered income independence, equal elapsed days, future/out-of-period exclusion, repayments/transfers, existing signed-income/absolute-expense semantics, zero median, insufficient/short/stale histories, outliers, date bounds, unknown current records, and text-only rendering.

Rendered a clearly labeled synthetic fixture at desktop and 390px width; two columns stack on mobile, document width and scroll width both 390px. Inspected actual app navigation to cashflow without login; module integration works, missing history withholds comparison. No authenticated user data inspected or changed. No browser console errors observed. Budget adequacy is intentionally not assessed.

UI refinements: unknown empty current period displays '기록 없음', provisional history warning is visible above results, and secondary category total uses the same repayment classifier as consumption analysis. Whole-period category panels and old overall cashflow chart remain secondary references, not same-day comparisons.

Check gate: local checks passed. GitHub and production verification recorded in final report after deployment.
