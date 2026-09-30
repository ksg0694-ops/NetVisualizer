# Project dashboard: selected concept 2

## Plan / Design (2026-09-30)
- Replace statistics and upcoming deadlines with a grouped project accordion.
- Keep category colors; use Tabler outline category icons, horizontal actual-item journeys, current activity, and an expanded checklist.
- Preserve all stored data and existing editors, calendar, Gantt, owner/version guards.
- Journey uses registered activities/events/milestones (ordinary tasks as fallback), ordered by start date. Never infer completion from elapsed dates or fabricate project stages.
- Projects with at least one active item and all active items completed are grouped in a collapsed completed section. Empty projects remain visible.
- Inline completion uses the existing validated/versioned save path. Reopening sets status doing/progress zero; dates and metadata remain unchanged.
- Native details/summary, labelled checkboxes, keyboard focus, mobile single-column layout. Expansion survives redraw and clears on account reset.

## Check plan
- Unit tests: scoped journey ordering, actual status, archives/deletion, empty/completed projects, completion normalization.
- Browser: expand/collapse, inline completion/reopen, add/edit, desktop/mobile overflow, console.
- Compare selected image with implementation; document intentional data-driven differences.

## Do / Check / Report — 2026-10-01
- Implemented category-colored accordion, actual-item journey, current activity, inline completion/reopen, project-scoped add, completed section.
- No DB schema or user record migration. Existing owner/version guarded store reused.
- Synthetic browser verifies completion/reopen, editor, add/save, completed grouping; desktop and 390px mobile inspected, no console errors or outer overflow.
- Visual gate passed after icon tint and label size corrections; see root design-qa.md.
- Final full npm check passed with 75 regression tests and 57 offline assets (revision 1bb923195169384b).
