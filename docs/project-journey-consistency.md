# Project journey consistency — 2026-10-01

Plan/design: show all active items in chronological journey order regardless of type/category. Keep calendar rules unchanged. Use existing note field for free-text detail tasks; no new task hierarchy or database migration.
Do: remove activity/event preference; add multiline escaped note display beneath expanded item titles and clarify editor label/placeholder. Existing notes preserved; note lines are not independently tracked tasks.
Check: mixed-type/category regression, note preservation/escaping, browser type switch and note editing; full test suite.

Report: full npm check passed (76 tests). Synthetic ADsP activity changed to task and remains in the four-step journey alongside other activities. Multiline notes saved and rendered below the item; 390px mobile has no outer overflow. No user records modified by QA. Supersedes the type-preference design in project-dashboard-redesign.md.
