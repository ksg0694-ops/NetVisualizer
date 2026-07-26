# Phase 1 CFO Structure Design QA

## Evidence

- Source visual truth:
  - User Phase 1 CFO structure specification dated 2026-07-26.
  - Monthly Report reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-02.png`.
  - Personal CFO reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-03.png`.
  - Cash-flow reference: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-0726-deck-review\slide-04.png`.
- Implementation:
  - Monthly Report: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\monthly-report-1366x768-final-fixed.png`.
  - Personal CFO desktop: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\personal-cfo-1366x768-pass1.png`.
  - Personal CFO mobile: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\personal-cfo-390x844-final.png`.
  - Cash flow: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\cashflow-1366x768-pass1.png`.
  - Long-term Goal: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\long-goal-1366x768-final.png`.
  - Long-term asset prediction hover: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-1876\after-asset-prediction-hover-1440x900.png`.
- Combined comparison:
  - Monthly Report: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-monthly-report-final.png`.
  - Personal CFO: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-personal-cfo-pass1.png`.
  - Cash flow: `C:\Users\ksg06\AppData\Local\Temp\netvisualizer-phase1-cfo-1876\compare-cashflow-pass1.png`.
- Viewports: 1366 × 768 and 390 × 844 CSS px, device scale factor 1.
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
- Monthly Report: every major report block is visible without clipping at 1366 × 768, and the monthly cash-flow trend is absent.
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

## Findings

No actionable P0, P1, or P2 design differences remain.

P3 follow-up: replace the Tailwind CDN runtime with a compiled production stylesheet during a separate infrastructure pass.

final result: passed
