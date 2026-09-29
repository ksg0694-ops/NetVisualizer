# Project management v1

## Plan
- Add Project under life tools: personal projects (career, certification, assets, travel, personal), dated tasks, status, progress, priority and milestones.
- Dashboard shows project progress, this week's tasks and approaching/overdue deadlines. Gantt, Tasks and Calendar use the same records and project filter.
- No Google Calendar writes/OAuth in v1; local calendar displays task dates. No invented examples saved to user accounts. Retired legacy project UI/data remains untouched.

## Design / security
- Separate personal_projects and personal_project_tasks tables, owner RLS, composite owner/project foreign key, optimistic version check on edits. Archive/restore instead of permanent deletion.
- Status/progress consistency: waiting=0, completed=100, in-progress=0..99. Project progress is the mean of non-archived task percentages; no tasks means unmeasured.
- Inclusive local ISO dates (no UTC date shift), start<=end, milestone one day, task calendar/month and weekly Gantt scroll independently on narrow screens. Explicit empty/offline/error states.
- Shared feature module with isolated store/model; native dialog forms, safe escaped rendering, keyboard-accessible controls and focus restoration. Account switch invalidates pending loads/writes and clears displayed private data.
- Cloud loads on first entry/manual sync; no promise of realtime collaboration or external Calendar synchronization.

## Check / report gates
- Validate model dates, status, project aggregates, weekly/deadline boundaries; test owner isolation and cross-owner references, optimistic conflict, archive/restore, account switch and UI navigation.
- Full npm check; synthetic desktop/mobile browser QA of create/edit, tabs and filters before deployment. Apply schema only after local database tests. Preserve all existing finance data.

## Check results / report (2026-09-29)
- Full npm check passed: 63 tests, including in-process PostgreSQL owner/constraint tests. Explicit column projections satisfy the existing data-access contract.
- Synthetic browser QA: create project/task, complete task (100%), archive and restore, project filter, Gantt and next-month Calendar verified. At 390px there is no outer horizontal overflow; edit dialog scrolls within the viewport.
- Actual application route ?view=project verified signed out with disabled writes and login guidance. Authenticated production write was not performed; no sample records were saved to a real account.
- Additive migration applied successfully to connected database; owner policies verified. No existing finance tables or records modified.
- Synthetic screenshot: outputs/project-dashboard-qa.png (ignored, never published).
- Delivery revision: b4dbda2879b85f61. External Calendar sync is not implemented in v1.
