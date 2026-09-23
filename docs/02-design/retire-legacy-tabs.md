# Retire legacy ERP tabs — 2026-09-24

## Plan
- Export cloud Todo and Learning notes to private UTF-8 TXT files before removing access.
- Remove Finance Home, legacy Cashflow, Todo and Learning Archive from desktop/mobile navigation.
- Populate the fixed-cost register from reviewed transactions without modifying the ledger.

## Design
- Default and retired routes resolve to the current Cashflow dashboard.
- Stop loading retired note editors; preserve cloud and device records for recovery.
- Retain hidden legacy finance DOM dependencies used by shared rendering and Monthly Report; do not expose a retired route.
- Keep private backups under untracked outputs/, never deploy personal notes or financial rows.
- Verify note IDs/counts/content, route regressions, full repository checks and deployed assets.

## Do
- Cloud backup created before navigation changes; no source records deleted.
- Fixed-cost register populated with 10 active items and 3 inactive review candidates.

## Check / Report
- Full npm check passed, including 39 regression tests, route fallback and persisted-state migration.
- Private TXT exports verified against every exported record ID, title and full body; source records preserved.
- No note editor scripts loaded at startup. Retired finance containers are hidden/inert for shared-render compatibility.
- Fixed-cost cloud counts rechecked after insertion. Inactive review items are excluded from monthly totals.
- v194 prepared for publication; run npm run deploy:verify after GitHub Pages completes.
- Unrelated security follow-up: four real_estate_* reference tables have RLS disabled and anon write grants. No permission changes made in this task.
