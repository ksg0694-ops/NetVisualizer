# NetVisualizer Handoff Brief

## Current Goal

Build a personal fintech/life operating app that covers features not provided well by Toss or Banksalad: personal finance cockpit, portfolio monitoring, cashflow import, long-term asset tracking, real-estate subscription planning, quant strategy structure, and Life tools.

## Working Rules

- Work in `C:\Users\ksg06\Documents\NetVisualizer`.
- Default workflow is local-only editing.
- Commit or push only when the user explicitly asks.
- Browser verification should be done only when needed or requested.
- Keep changes scoped and avoid staging unrelated local folders.
- Current deployment target remains static GitHub Pages. Do not migrate to React/Vite unless a separate review or PoC is requested.

## Current Architecture

The app is still a static HTML/CSS/JavaScript app, but the old monolithic inline JavaScript has been split into feature modules under `js/features`.

- `index.html`: UI markup, CDN imports, feature script loading.
- `js/features/appCore.js`: global state, settings, cache, Supabase loading, parsing, chart helpers, transaction modal.
- `js/features/appShell.js`: service worker registration, event binding, navigation, bootstrapping.
- `js/features/assetTrend.js`: long-term asset trend model.
- `js/features/weeklyTimetable.js`: Life weekly timetable, 10-minute editing, week template, company work block, holiday skip.
- `js/features/quantEngine.js`: quant strategy structure, rebalance signals, market price sync/save helpers.
- `js/features/realEstate.js`: subscription schedule cards and Leaflet map rendering.
- `js/features/transactionImport.js`: CSV/TSV/XLSX transaction import, preview, dedupe, audit history, Supabase insert.
- `js/features/portfolioEditor.js`: portfolio edit modal and DB update flow.
- `js/features/cashflowControls.js`: cashflow management toggles and card/insurance add-on rendering.
- `js/features/portfolioViews.js`: portfolio and investment detail rendering.
- `js/features/financeViews.js`: finance summary, asset trend rendering, cashflow rendering, roadmap, real-estate funding status.
- `js/features/vacationPlan.js`: Life vacation planning with localStorage plus optional Supabase sync.
- `js/features/healthTracker.js`: Life health weight tracking with localStorage plus optional Supabase sync.

## 2026-06-19 Feature Cleanup Baseline

- Work is on local branch `codex/netvisualizer-analysis`.
- Supabase browser client creation is now singleton-based in `getSupabaseClient()`, removing repeated GoTrueClient warnings during normal browser smoke tests.
- `appCore.js` now separates default startup tables from reserved real-estate detail tables. Startup fetches only current UI dependencies; detail real-estate tables remain queryable when a future detail screen needs them.
- Optional table fetch failures keep existing cache data instead of replacing cache entries with empty arrays.
- Portfolio investment detail now switches views before rendering the strategy chart, fixing the zero-size doughnut chart.
- PWA cache/script versions were bumped for `appCore.js` and `portfolioViews.js`.
- Base finance schema and Finance/Quant schema drafts were consolidated into `supabase/migrations/20260619072000_create_base_finance_tables.sql` and `supabase/migrations/20260619073000_consolidate_finance_quant_schema.sql`.
- Cleanup report: `docs/04-report/feature-cleanup-2026-06-19.md`.

## 2026-06-21 Real Estate DSR Simulator

- Added a Real Estate tab `청약 자금 시뮬레이터` panel on branch `codex/netvisualizer-analysis`.
- The simulator connects current portfolio readiness, target sale price, income/rate/term assumptions, current-year cash-flow run rate, estimated monthly payment, estimated stressed DSR, DSR-implied maximum loan, and months-to-ready.
- The main Real Estate tab is result-first: no inline input grid. Inputs open from the `가정 설정` modal.
- Main simulator summary now shows `준비 청약` and `예상분양가`; default target is `고양창릉 S2/S3/S4`.
- Extra explanatory copy and the `자기자금 부족분` card were removed from the main panel; the segmented funding bar covers the remaining funding gap.
- Finance Roadmap Phase 2 no longer shows a hard-coded 8억 target badge; the target amount lives in the Real Estate simulator instead.
- Planned loan is not manually entered. It is auto-calculated as `min(DSR-supported loan, target budget - current cash/safe funding)`.
- Assumptions persist locally under `smartbook_v2_realestate_analysis_v1`; the modal `기본값` button resets them.
- Dashboard 청약 준비율 and Finance Roadmap now use the same target budget and auto-calculated planned loan instead of fixed 8억/3억 values.
- Defaults are editable assumptions, not official lending guidance: target 8억, mortgage rate 4.5%, stress rate 1.5%, term 30 years, DSR limit 40%.
- Browser verification passed on desktop and 390px mobile. DSR 40% -> 50% increased the auto planned loan as expected. Only the existing Tailwind CDN warning remained.
- Report: `docs/04-report/realestate-dsr-simulator-2026-06-21.md`.

## Recent Refactor Result

- `index.html` was reduced from about 397 KB to about 144 KB.
- Inline `<script>` blocks were removed; feature code is loaded from external files.
- Service worker cache was updated to include the new feature modules.
- Syntax validation passed for all `js/features/*.js`.
- Combined script parse validation passed in the same script order used by `index.html`.
- No React/Vite migration was performed.

## Current Product Structure

- Top-level goals: Finance, Career, Project, Life.
- Finance tools: Portfolio, Cashflow, Long-term Asset, Real Estate/Subscription, Investment Detail.
- Life tools: Weekly Timetable, Routine Checklist, Vacation Plan, Health.
- Mobile tool navigation changes based on the active top-level goal.

## Important Behavior Notes

- Cashflow currently supports manual transaction add and file import from CSV/TSV/XLSX.
- Transaction import deduplicates against existing cached transactions before inserting.
- Portfolio edit modal updates portfolio rows and preserves asset classification fields.
- Quant functions are free-mode oriented; paid market data should not be assumed.
- Real-estate subscription data can come from Supabase rows, with fallback defaults for Goyang Changneung S2/S3/S4.
- Real-estate funding analysis is local-only and uses editable assumptions; it does not call bank, mortgage, or public-data APIs.
- Weekly Timetable persists per ISO week in localStorage and can register/reset a personal template.
- Health stores daily weight logs locally under `netvisualizer.life.healthWeight.v1`; if `health_weight_logs` exists in Supabase, it syncs by `log_date`.
- Health chart tracks actual daily weight entries plus a 7-day calendar-window rolling average.

## Suggested Next Steps

1. Review whether the Real Estate DSR simulator assumptions match the user's planning style.
2. If accepted, add scenario presets such as conservative/base/aggressive or link assumptions to a future settings table.
3. Consider adding a cash-flow budget insight next: fixed-cost ratio, monthly saving target, and over/under budget warnings.
4. Consider a later second-stage refactor that groups shared globals into a single `window.NetVisualizerApp` namespace. Do this only after the current modular version is stable.
5. Keep React/Vite as a later PoC option, not the next default step.

## Git Hygiene

Stage only:

- `README.md`
- `NEXT_CHAT_BRIEF.md`
- `index.html`
- `sw.js`
- `docs/04-report/*.md`
- `js/features/*.js`
- `supabase/migrations/*.sql`

Do not stage local/untracked workspace artifacts such as `.agents/`, `.codex/`, `docs/public-data-application/`, `tools/__pycache__/`, or temporary server logs.
