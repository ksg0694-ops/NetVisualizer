# Phase 1 CFO Structure Design QA

## Evidence

- Source visual truth:
  - User Phase 1 CFO structure specification dated 2026-07-26.
  - Monthly Report reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-02.png`.
  - Personal CFO reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-03.png`.
  - Cash-flow reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-04.png`.
- Implementation:
  - Monthly Report: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\monthly-report-1366x768-final-fixed.png`.
  - Monthly Report compact notebook: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\monthly-report-1280x720-final.png`.
  - Personal CFO desktop: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\personal-cfo-1366x768-pass1.png`.
  - Personal CFO mobile: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\personal-cfo-390x844-final.png`.
  - Cash flow: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\cashflow-1366x768-pass1.png`.
  - Long-term Goal: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\long-goal-1366x768-final.png`.
  - Long-term asset prediction hover: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-1876\after-asset-prediction-hover-1440x900.png`.
- Combined comparison:
  - Monthly Report: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-monthly-report-final.png`.
  - Personal CFO: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-personal-cfo-pass1.png`.
  - Cash flow: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-cashflow-pass1.png`.
- Viewports: 1366 × 768, 1280 × 720, and 390 × 844 CSS px, device scale factor 1.
- Source and implementation captures use equal pixel dimensions at each compared viewport; no density normalization was required.
- State: 2026년 7월 마감, actual ledger and asset data loaded.

## Full-view comparison

- The finance-tool navigation follows the requested order: Monthly Report, 개인 CFO, 현금흐름, 포트폴리오, 장기 목표. There is no standalone real-estate navigation item.
- Monthly Report matches the reference structure with one cash close/allocation block using a bar chart plus two donuts, one consolidated long-term goal chart, and the Phase 2 portfolio reservation.
- Personal CFO uses a single source → monthly allocation → asset-state flow. Variable income, consumption, and residual values are intentionally hidden.
- Cash flow begins with a compact monthly allocation block above the income and expense cards; the month-close panel is absent.
- Long-term Goal combines the income-trend asset path with available equity, mortgage capacity, total funds, and DSR.

## Focused-region comparison

- Personal CFO: income, spending, and residual use `월별 변동`; the former fixed `400만원` and residual amount are not displayed. Known repayment and savings rules remain visible.
- Monthly Report: every major report block is visible without clipping at 1366 × 768 and 1280 × 720, and the monthly cash-flow trend is absent.
- Long-term Goal: the actual asset line, income-trend forecast, and target line remain visible after switching away and back to the tab.
- Housing capacity: assumption settings open and close from Long-term Goal; no standalone schedule or map is rendered.

## Required fidelity surfaces

- Fonts and typography: the existing Pretendard hierarchy, weights, and compact financial labels are preserved.
- Spacing and layout rhythm: sidebar, 12-column report grid, card radii, shadows, and gaps use the existing product system. Grid items explicitly allow shrinking at notebook widths.
- Colors and visual tokens: existing indigo, blue, rose, emerald, lime, amber, violet, and slate semantics are reused.
- Image quality and assets: existing Font Awesome icons are retained; Chart.js 4.4.7 is vendored locally for deterministic chart rendering.
- Copy and content: unclear monthly values use `금액 미표시`; stable allocation rules and actual balance-sheet values retain amounts.

## Interaction and runtime checks

- Monthly Report month navigation: 2026년 7월 → 2026년 6월 → 2026년 7월 passed.
- Finance primary navigation and mobile Personal CFO tab passed.
- Long-term Goal assumption modal open and close passed.
- Hidden-tab chart resize: Monthly Report canvas restored to 408 × 278 CSS px; Long-term Goal canvas restored to 660 × 380 CSS px.
- Browser console: zero application errors. The known Tailwind CDN production warning remains a separate infrastructure follow-up.
- `npm.cmd run check` passed, including forecast math and UI contracts.

## Comparison history

1. The first implementation pass aligned Monthly Report and Personal CFO with the reference slides.
2. After forecast logic extraction, the asset chart was blank because Chart.js retained a 0×0 canvas initialized in a hidden tab.
3. Chart.js 4.4.7 was vendored locally and chart updates now call `resize()` after the target tab becomes visible.
4. The final 1366 × 768 comparison shows the requested bar/donut cash block and visible long-term forecast with no clipping.
5. A 1280 × 720 GitHub Pages check exposed a minimum-width collision between the cash bar and donut column. The inner grid now shrinks to the available width and passes with `scrollWidth === clientWidth`.

## Findings

No actionable P0, P1, or P2 design differences remain.

P3 follow-up: replace the Tailwind CDN runtime with a compiled production stylesheet during a separate infrastructure pass.

final result: passed

## Portfolio Phase 2 compact list — 2026-07-26

### Evidence

- Source visual truth:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-compact-1876\source-portfolio-1280x720.png`
- Rendered implementation:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-compact-1876\final-portfolio-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-compact-1876\final-safe-expanded-1280x720.png`
- Equal-size comparison:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-compact-1876\compare-portfolio-source-final.png`
- Viewports: 1280 x 720 and 390 x 844 CSS px at device scale factor 1.
- State: latest portfolio, CFO groups collapsed plus safe-assets expanded state.

### Full-view comparison

- The CFO group list uses less vertical space while preserving the existing five-group order, card language, icons, colors, and totals.
- Housing now carries the 65,000,000 KRW repayment badge; operating assets no longer show a repayment amount.
- The right column retains sufficient whitespace and no content is clipped at 1280 x 720.

### Focused-region comparison

- Expanded safe assets fit five sorted rows inside one compact card without truncated amounts.
- Operating assets contain only 생활비통장 and 월급통장 in that order.
- Housing items are ordered by amount magnitude: 전세금, housing loan, then 청약통장.
- Investment accounts and holdings are sorted by descending evaluated amount.

### Required fidelity surfaces

- Typography: existing Pretendard hierarchy is preserved; list metadata and secondary values are reduced without losing legibility.
- Spacing: accordion gaps, header padding, icon size, account headers, and item rows are compacted consistently.
- Colors: the existing indigo, violet, teal, slate, and rose semantic tokens are unchanged.
- Assets: existing Font Awesome icons and Chart.js chart rendering are retained; no new raster assets are required.
- Copy: operating and housing purposes now match the revised debt classification.

### Findings and checks

- No actionable P0, P1, or P2 differences remain.
- Portfolio has no horizontal overflow at 390 x 844.
- Total assets 300,628,856 KRW, liabilities 65,000,000 KRW, and net worth 235,628,856 KRW remain reconciled.

final result: passed

## Phase 1 alignment and Portfolio Phase 2 grouping — 2026-07-26

### Evidence

- Source captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\phase2-portfolio-groups\source-long-goal-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\phase2-portfolio-groups\source-personal-cfo-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\phase2-portfolio-groups\source-portfolio-1280x720.png`
- Final captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\final-long-goal-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\final-personal-cfo-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\final-portfolio-1280x720.png`
- Equal-size source/final comparisons:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\compare-long-goal-source-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\compare-personal-cfo-source-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-final-1876\compare-portfolio-source-final.png`
- Viewports: 1280 x 720 and 390 x 844 CSS px at device scale factor 1.

### Findings and checks

- Long-term Goal no longer renders the baseline-salary KPI.
- Personal CFO source, allocation, and asset columns share the same desktop height; allocation rows and asset-step rows align vertically.
- Portfolio uses the five requested CFO-purpose groups in order: operating, safe, investment, housing, and pension.
- Product attributes override source folders: 한국투자 IMA S1 is included in safe assets.
- Grouped totals reconcile to 300,628,856 KRW of assets, 65,000,000 KRW of liabilities, and 235,628,856 KRW of net worth.
- Operating assets show 1,000,000 KRW of consumption cash and 65,000,000 KRW of repayment obligations without netting them together.
- Safe-group accordion expansion and investment-detail navigation passed.
- Portfolio and Personal CFO both satisfy `scrollWidth === clientWidth` at 390 x 844.
- No actionable P0, P1, or P2 design differences remain.

final result: passed

## Salary-rule and two-step CFO iteration — 2026-07-26

### Evidence

- Source captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\source-monthly-report-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\source-long-goal-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\source-personal-cfo-1280x720.png`
- Final implementation captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\final-monthly-report-1280x720-v1.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\final-long-goal-1280x720-v1.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\final-personal-cfo-1280x720-v1.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\final-personal-cfo-390x844-v1.png`
- Equal-size comparisons:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\compare-monthly-report-v1.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\compare-long-goal-v1.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\salary-rule-iteration\compare-personal-cfo-v1.png`
- Viewports: 1280 x 720 and 390 x 844 CSS px at device scale factor 1.

### Findings and checks

- The allocation chart and donut column use the same stretched grid height; the `저축+잔여` bar displays `+215만원` above the bar.
- The forecast uses the lowest observed salary, currently 3,538,000 KRW, as the regular monthly salary.
- Twelve regular salary payments represent 18/20 of annual salary; February and September each add a 1/20 holiday bonus.
- The displayed year-end asset forecast changed from 245,705,807 KRW to 243,867,318 KRW under the conservative salary calendar.
- Personal CFO has no route tags such as `월 운영` or `부채 감소`.
- Assets are grouped into step 1 safe assets and step 2 pension, housing, and investment assets.
- Mobile Personal CFO has no horizontal overflow at 390 x 844.
- Full runtime, forecast, UI, TypeScript, repository, domain, Supabase, and static asset checks passed.
- No actionable P0, P1, or P2 design differences remain.

final result: passed

## Compact Phase 1 CFO iteration — 2026-07-26

### Evidence

- Deployed source captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\source-monthly-report-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\source-cashflow-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\source-long-goal-1280x720.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\source-personal-cfo-1280x720.png`
- Final implementation captures:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\monthly-report-1280x720-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\cashflow-1280x720-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\long-goal-1280x720-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\personal-cfo-1280x720-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\personal-cfo-390x844-final.png`
- Equal-size before/after comparisons:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\compare-monthly-report-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\compare-cashflow-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\compare-long-goal-final.png`
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-compact-1876\compare-personal-cfo-final.png`
- Viewports: 1280 x 720 and 390 x 844 CSS px at device scale factor 1.

### Findings and checks

- Desktop and mobile finance navigation now follows Monthly Report, Cash Flow, Portfolio, Long-term Goal, Personal CFO.
- Monthly Report uses the single `현금흐름` heading and keeps all primary content visible at 1280 x 720.
- Cash-flow consumption is 886,272 KRW and excludes the separate 1,273,267 KRW repayment allocation.
- The long-goal chart legend is `자산 예상`; the mortgage assumption input is fixed and disabled at Stress DSR 40%.
- The lending sufficiency judgment badge and redundant explanatory copy are absent.
- Personal CFO uses a restrained indigo/slate palette and stacks without horizontal overflow at 390 x 844.
- Settings modal open/close, tab switching, chart resize, and selected-month rendering passed.
- Browser console: zero application errors.
- No actionable P0, P1, or P2 design differences remain.

final result: passed

## Portfolio duplicate key-card removal — 2026-07-28

### Evidence

- Source with duplicate cards:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase2-portfolio-compact-1876\final-portfolio-1280x720.png`
- Implementation without duplicate cards:
  - `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-portfolio-no-keycards-1876\portfolio-no-keycards-1280x720.png`
- Viewports: 1280 x 720 and 390 x 844 CSS px at device scale factor 1.

### Findings and checks

- The five top key cards duplicated the CFO holdings list and were removed.
- Net-worth summary, CFO composition chart, group order, amounts, liability badge, and accordion interactions remain unchanged.
- The portfolio hierarchy is clearer because the title now leads directly into the primary summary and holdings list.
- Mobile satisfies `scrollWidth === clientWidth` at 390 x 844.
- No actionable P0, P1, or P2 differences remain.

final result: passed
