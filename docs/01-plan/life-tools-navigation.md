# Life tools navigation

## Plan / Design
Move existing insurance/card UI to its own life-tools view and link it in desktop
and mobile navigation. Keep the old cashflow shortcut working. Reuse existing
account-scoped data and rendering; no migration or new data copies.
Mark tasks and learning archive as pending deletion in navigation and page context.
Retain their routes, features and all data. Backup and deletion are separate future
user-authorized operations; neither is performed by this change.

## Do / Check / Report
- Added independent top-level insurance-cards-view with desktop/mobile life links,
  restorable view state, direct route and active-view data refresh.
- Legacy cashflow shortcut opens the new view. Existing data renderer reused.
- Explicit unauthenticated and empty states; no database or storage writes added.
- Task/archive navigation and context marked pending deletion; features preserved.
- Full npm check passed (32 foundation tests and all contracts).
- Browser verified desktop route, both retained features and 390px mobile menu
  navigation. Private authenticated holdings were not used in browser validation.
- Prepared v191 cache; no backup or deletion performed.

## Check plan
Verify top-level view visibility, active menu, refresh, empty/auth state and retained
legacy routes. Run project checks and verify production assets after publication.
