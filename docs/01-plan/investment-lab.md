# Investment Lab / sync repair — Plan

Approved 2026-09-16. Preserve both legacy portfolio screens. Add investment Lab using the existing authenticated source, valuation model and GitHub Pages deployment (not a separate Data App runtime). No private fixture data shipped.

1. Add the three missing sync result columns, safe error codes and a payload/schema regression. Apply additive migration only and verify a normal sync completes.
2. Pure Lab model: account filter, strategy groups, instrument aggregation, weighted comparable return, covered-value share, stale/missing flags, area-preserving layout.
3. Investment Lab: KPI strip, grouped treemap, contribution bars, exact holdings, keyboard/touch details and legacy editor handoff. No invented daily changes/targets.
4. Test calculations, hostile labels, refresh/account isolation, desktop/mobile visuals, source integration, CI and live deployment.
