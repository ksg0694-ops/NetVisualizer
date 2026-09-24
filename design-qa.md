# Personal balance sheet design QA

## Artifacts and state
- Source: `C:/Users/ksg06/.codex/generated_images/01a092fd-d241-7a60-9183-1a95b878af42/exec-301cee0e-032a-4430-b19b-686d86300c97.png` (1586×992).
- Implementation: `outputs/bs-desktop.png` (1440×900, CSS 1440×900, DPR 1); mobile evidence is the inline full-page browser screenshot in this task (390px CSS viewport, DPR 1, 375px content excluding scrollbar). Subsequent file capture failed after a development reload, so no mobile file path is claimed.
- Local fixture: `/outputs/balance-sheet-qa.html`, synthetic account and 35 monthly records. Private production source was separately verified through database readback; no signed-in browser session was available.
- Full comparison: source and desktop capture emitted together in one browser-tool response. Compare content region, not mock sidebar: live navigation deliberately retains the existing ERP shell. Source has a single observation, whereas the user's latest instructions require monthly history and nested housing debt. Fixture amounts are intentionally different.

## Findings and iterations
- During functional inspection the housing breakdown selector matched the housing icon. Fixed with `.bs-housing:not(.bs-icon)`. The post-fix AX state and desktop capture show asset and loan figures even when holdings are collapsed.
- First combined visual comparison after that fix: no actionable P0/P1/P2 findings against the amended brief. Smaller type, less KPI decoration and shorter row spacing are intentional compact-design changes. A holdings-details expansion replaces the mock's drill-down chevrons.
- Fonts/typography: existing Korean system sans fallback, tabular figures, clear KPI hierarchy; mobile values readable and do not overlap.
- Spacing/layout: white KPI strip, aligned two-panel desktop; single-column mobile; analysis table scrolls within its panel, not the page.
- Colors/tokens: neutral background, subtle purpose icons, indigo selection/line. Positive monthly changes red, negative blue.
- Image/asset fidelity: no raster artwork needed; existing Font Awesome icons are reused. Mock decorative KPI circles omitted for compactness.
- Copy/content: five purpose groups, no duplicated net-worth footer, housing loan nested, concise historical-source note. Missing attribution is visibly uncomputed.
- Focused image crops were unnecessary: the combined full-view captures clearly show all KPI, group and chart labels; mobile capture separately checks wrapping and density.

## Verification
- Production app route renamed and logged-out state hides all private figures.
- Synthetic desktop: 35-point history, current observation, balance/change toggle, year selection, monthly-analysis expansion.
- Synthetic mobile: 390×844 viewport, no page horizontal overflow; internal table overflow remains scrollable.
- Browser console error log: empty during fixture verification.
- Residual gap: authenticated end-to-end quote/FX refresh and real-account visual verification require the user's signed-in session. Server function deployment, source row counts, reconciliation and owner-RLS tests are separately checked; they are not represented as signed-in UI tests.

final result: passed
