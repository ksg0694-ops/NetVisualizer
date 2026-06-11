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
- Life tools: Weekly Timetable, Routine Checklist, Vacation Plan.
- Mobile tool navigation changes based on the active top-level goal.

## Important Behavior Notes

- Cashflow currently supports manual transaction add and file import from CSV/TSV/XLSX.
- Transaction import deduplicates against existing cached transactions before inserting.
- Portfolio edit modal updates portfolio rows and preserves asset classification fields.
- Quant functions are free-mode oriented; paid market data should not be assumed.
- Real-estate subscription data can come from Supabase rows, with fallback defaults for Goyang Changneung S2/S3/S4.
- Weekly Timetable persists per ISO week in localStorage and can register/reset a personal template.

## Suggested Next Steps

1. Do a quick browser smoke test after the modularization: dashboard, portfolio, cashflow, import modal, weekly timetable, real-estate map.
2. If smoke test is clean, continue feature work from the modular files instead of editing large blocks in `index.html`.
3. Consider a later second-stage refactor that groups shared globals into a single `window.NetVisualizerApp` namespace. Do this only after the current modular version is stable.
4. Keep React/Vite as a later PoC option, not the next default step.

## Git Hygiene

Stage only:

- `README.md`
- `NEXT_CHAT_BRIEF.md`
- `index.html`
- `sw.js`
- `js/features/*.js`

Do not stage local/untracked workspace artifacts such as `.agents/`, `.codex/`, `docs/public-data-application/`, `tools/__pycache__/`, or temporary server logs.
