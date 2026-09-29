# Project overview refinement

## Plan / design
- Shared category colors: career blue, certification violet, assets teal, travel orange, personal rose. Keep text labels; status remains text, not the bar color.
- Compact Dashboard: neutral summary strip, category-accented project progress cards, one deduplicated upcoming/overdue list capped at five with full-list link. Detailed Gantt moves to its dedicated tab.
- Gantt defaults to all task dates in selected projects; week/month controls allow focused navigation. Group rows by project, keep all dates accessible, show today marker when in range. Percentage positions and bounded tick count avoid huge DOM for multi-year projects.
- Existing records and calendar visibility unchanged; no database migration.

## Check gate
- Range/boundary/empty/multi-year model tests, full checks, desktop/mobile synthetic browser verification before batch deploy.

## Check / report (2026-09-30)
- Full npm check passed, 65 tests. Date tests include whole project extent, empty/single-day, leap February, year boundary and multi-century bounded ticks.
- Synthetic five-category projects verified on desktop and 390px: category color consistency, all/month/week navigation, selected-project extent, full-width mobile chart and no document overflow.
- Dashboard full-list link verified; no browser console errors. Screenshots outputs/project-dashboard-overview.png and outputs/project-gantt-overview.png are synthetic and excluded from git.
- No database or private data changes. Release revision ad39f441053b1597.
