# Project calendar types

## Plan / design
- Distinguish task, ongoing activity, and key event. Default calendar visibility: deadline, hidden, deadline respectively; users can override to hidden/deadline/full period.
- Preserve existing records as task/full period; do not infer types from private titles. Existing milestones retain their date semantics.
- Gantt and progress continue using every active item regardless of calendar visibility. Key events are single-day milestones.
- Add checked columns without changing ownership policies. Older clients must preserve fields on update.

## Check gate
- Model defaults, validation, calendar date inclusion, unchanged aggregates, database constraints and migration preservation; full npm check before deployment.

## Check / report
- All 64 tests and full npm check passed. Migration preserves existing records as task/full with unchanged versions and dates; database constraints reject invalid types/modes and multi-day events.
- Synthetic browser: study activity defaults hidden, remains in Gantt, is absent from Calendar; key event aligns dates and appears on the selected day without a misleading deadline suffix.
- Additive migration applied; no user task titles, dates or classifications rewritten. Existing rows can be reclassified in the editor.
- Revision aed15283df086c5f. Screenshot outputs/project-types-qa.png is synthetic and excluded from publication.
