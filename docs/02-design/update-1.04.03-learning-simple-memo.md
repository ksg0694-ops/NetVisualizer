# Update 1.04.03 Learning Archive Simple Memo Design

## Editor model

Each stored content line is rendered as one plain editable line. Leading spaces remain indentation, while checkbox, heading, callout, divider, and table syntax receive no special UI treatment.

## Data preservation

No stored note is rewritten during the release. Existing strings such as `- [ ]`, `##`, or `> [!NOTE]` remain in the content and become directly editable text when opened.

## Removed dependencies

- Learning Archive no longer reads `ChecklistFeature`.
- Task and Step conversion events are removed.
- Task-derived context cards and Report links are removed.
- Block definitions, menus, transforms, icons, and checkbox state handlers are removed.

## Remaining UI

- Basic text formatting: B, U, S.
- Title and body editing with autosave and explicit save.
- Note-to-note links, versions, TOC, search, and hierarchy ordering.
