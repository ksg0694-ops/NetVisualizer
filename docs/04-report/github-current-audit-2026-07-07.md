# GitHub Current Audit - 2026-07-07

## Scope

- Working clone: `C:\Users\ksg06\Documents\NetVisualizer-github-current`
- Source: `https://github.com/ksg0694-ops/NetVisualizer.git`
- Commit reviewed: `4e38b5f` (`main`, "Simplify health tracker view")
- Audit branch: `codex/github-current-audit`
- bkit tools: `bkit_detect_level` and `bkit_get_status` were not available in this Codex session.
- PDCA status file: `docs/.pdca-status.json` is missing.
- Manual level judgement: Dynamic, because the app is a static PWA backed by Supabase BaaS and Edge Functions.

## Verification

| Check | Result |
| --- | --- |
| Fresh GitHub clone | Passed |
| `git status --short --branch` | Clean on `codex/github-current-audit` before this report |
| JS syntax check | Passed for all `js/features/*.js` via `node --check` |
| Manifest JSON parse | Passed with UTF-8/Node; failed only when read through Windows PowerShell's default encoding |
| Local server | Passed with `npx.cmd http-server -p 8080 -c-1` |
| Browser first load | Passed at `http://127.0.0.1:8080/` |
| Browser console on first load | No warning/error entries observed |
| Static asset references | Added automated local ref check |

## Findings

### Resolved - `manifest.json` validation needs an encoding-safe check

`manifest.json` is valid when read as UTF-8 and when parsed by Node. The earlier failure was a Windows PowerShell default-encoding false positive, where Korean text was decoded incorrectly before `ConvertFrom-Json`.

Impact:
- Manual validation can report a false failure if it omits `-Encoding UTF8`.
- CI should use Node or an explicit UTF-8 read so the result is stable across shells.

Applied fix:
- Added `npm run check:manifest`, backed by `tools/check-manifest.mjs`.

### P1 - Public Supabase posture is not ready for broad deployment

The frontend contains a public Supabase URL and publishable key in `js/features/appCore.js`. Project docs also state that RLS remains disabled on public tables.

Impact:
- Acceptable only for tightly controlled personal/local use.
- Unsafe for public sharing, multi-user usage, or expanded automatic finance sync.
- Edge Functions use admin/service credentials internally, so caller authorization and per-user ownership must be designed before enabling broader write flows.

Recommended fix:
- Add Auth, `user_id`/ownership columns, and RLS policies before any public deployment or provider sync expansion.
- Keep provider sync disabled by default until policy coverage exists.

### P1 - No automated quality gate exists

There is no package/test setup that validates syntax, manifest JSON, browser smoke behavior, or Supabase contract drift.

Impact:
- Regressions such as the broken manifest can reach `main`.
- Large static app changes are hard to review safely.

Recommended fix:
- Add a local smoke test and Supabase contract checks.
- Add CI for these checks before merging to `main`.

Applied fix:
- Added a minimal `package.json` with `check`, `check:manifest`, and `check:js`.
- Added `tools/check-js-syntax.mjs` to run `node --check` over feature scripts and `sw.js`.
- Added `check:supabase-contract` to fail on new `.select('*')` usage or wildcard column contracts.
- Added `check:static-assets` to verify local `index.html`, `manifest.json`, and `sw.js` refs point to existing files.

### P2 - App architecture is still strongly coupled through global state

`js/features/appCore.js` still owns shared state, Supabase setup, cache parsing, render orchestration, chart helpers, and transaction modal behavior. `index.html` also keeps large static markup and inline event handlers.

Impact:
- Changes in one feature can accidentally affect unrelated screens.
- Testing feature behavior independently is difficult.
- Lazy loading by feature is not possible yet.

Recommended fix:
- Introduce a small app state/data service layer.
- Move screen-specific state and commands behind feature modules.
- Replace inline `onclick` with delegated event binding.

### P2 - Initial payload and CDN dependence are growing

Current local static payload is about 584KB before CDN assets. Feature JS alone is about 386KB. Runtime dependencies are loaded from Tailwind, Supabase, Chart.js, SheetJS, FontAwesome, Leaflet, and Google Fonts CDNs.

Impact:
- First load depends heavily on external network availability.
- PWA offline behavior is limited because third-party assets are not truly controlled.
- Performance tuning is hard without bundling and route-level splitting.

Recommended fix:
- Move to a simple Vite build or equivalent static bundling step.
- Compile Tailwind locally.
- Lazy-load heavy feature modules such as SheetJS, Leaflet, and health screens.

Applied fix:
- Added an explicit favicon link so browsers do not fall back to `/favicon.ico`.
- Added a static asset reference check for local files and service-worker cache entries.

### P2 - Supabase queries still over-fetch in several places

Most core queries now specify columns. The remaining wildcard column contracts in `appCore.js` have been removed; Vacation Plan has also been removed from the active app surface.

Impact:
- API payload grows as schemas grow.
- Frontend becomes sensitive to unrelated schema additions.

Applied fix:
- Replaced remaining wildcard selects with explicit column lists.
- Added `npm run check:supabase-contract` to prevent reintroducing wildcard Supabase reads.

Compatibility note:
- The live Supabase project does not yet expose `portfolios.account_order`, so that optional column is intentionally not part of the default portfolio select. The UI can still use local account-order fallback until the migration is applied remotely.

### P2 - `innerHTML` is widely used

Many render paths use template strings and `innerHTML`. The app already has `escapeHtml`, `escapeAttr`, and `escapeJsString`, and many sites are escaped correctly. The risk is future inconsistency.

Impact:
- XSS or broken UI can reappear if one new template forgets escaping.

Recommended fix:
- Standardize a rendering helper for trusted templates.
- Add a lint/search gate for unescaped dynamic interpolation in `innerHTML`.

## Product And Planning Notes

1. The product direction is strongest as a personal finance cockpit: net worth, cash flow, portfolio, real estate readiness, and quant signals.
2. Life is now narrowed to lightweight personal tools: Health tracking and a local-first 할일 tool with detailed notes, steps, and Career/Finance/Life domains. Weekly Timetable and Vacation Plan were removed until they can be redesigned as optional companion modules.
3. The next strategic milestone should be "trustworthy personal finance data" rather than more screens.
4. Before banking or market automation grows, the project needs Auth/RLS, ownership, audit logs, and rollback semantics.
5. The user-facing KPI set should be defined explicitly: net worth growth, monthly surplus, liquidity runway, investment allocation drift, real-estate readiness, and data freshness.

## 2026-07-08 Direction Update

The product direction is now login-based cloud sync, not local/private-only. The first implementation step adds Supabase Auth gating in the frontend and a non-destructive ownership preparation migration. RLS is intentionally not enabled directly by a normal migration because legacy rows must be backfilled and several global unique constraints must be converted to per-user constraints first.

Quant strategy settings and manually entered market prices should use user-specific override rows layered over shared defaults/API caches.

Prepared migration helpers:

- `backfill_netvisualizer_owner_data(...)` assigns legacy rows to the chosen owner and copies shared manual Quant/price settings into override tables.
- `finalize_netvisualizer_auth_rls(...)` dry-runs and then performs `not null`, per-user key conversion, and owner-only RLS after backfill is verified.

2026-07-10 implementation status:

- The live Supabase migration ledger is synchronized through `20260710120000_extend_life_todos_details.sql`.
- `life_todos`, `app_user_profiles`, and the user-specific Quant/market-price override tables exist in the live project.
- Existing personal rows were assigned to `ksg0694@naver.com`, RLS finalize dry-run returned zero null owner rows, and owner-only RLS was applied.
- Next work starts at GitHub main integration and durable signed-in browser smoke wiring.

## Suggested PDCA Roadmap

### Plan

- Define the next feature goal as "safe finance data foundation".
- Decide whether the app remains personal/local or moves toward authenticated cloud usage.

### Design

- Design Auth/RLS and `user_id` ownership.
- Define table-level access policies and Edge Function caller checks.
- Choose the minimum build/test toolchain.
- Decide whether real-estate subscription rows are shared reference data or a private user watchlist.

### Do

- Keep `manifest.json` validation on the Node/UTF-8 path.
- Add browser smoke checks.
- Add a browser smoke test for first load and no console errors.
- Add signed-in smoke coverage for Auth/RLS and checklist cloud sync.

### Check

- Verify local server load.
- Verify manifest parse.
- Verify core Supabase reads.
- Verify transaction import/portfolio edit flows in dry-run or test fixtures.

### Report

- Restore `docs/.pdca-status.json`.
- Keep one current roadmap/status document rather than spreading status across many historical reports.
