# Update 1.04.03 Todo Simple Note — Design

## Decision

The Todo feature remains a workbench. Only its detail-note renderer is simplified.

## Editor contract

- Toolbar: Bold, Underline, Strike only.
- Editing: plain per-line content editing with Enter, Backspace, and Tab indentation.
- Persistence: the existing hidden note source and autosave pipeline remain unchanged.
- Compatibility: checkbox, callout, table, divider, and icon tokens are displayed as literal text.

## Protected features

Todo completion, Monitor status, domain assignment, Step data, title editing, note versions, and Report Library are outside this removal scope.
