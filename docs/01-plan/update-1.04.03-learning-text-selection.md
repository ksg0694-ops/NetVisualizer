# Update 1.04.03 Learning Archive Text Selection Plan

## Goal

- Restore normal mouse drag selection for multiple characters and multiple lines.
- Preserve exact single-click caret placement on blank and populated editor areas.
- Keep formatting, keyboard selection, checklist, and autosave behavior intact.

## Root cause hypothesis

The editor's trailing click handler always recalculated a collapsed caret range after pointer selection, replacing the browser's non-collapsed text range.

## Acceptance criteria

- A pointer drag selection remains selected after pointerup and click.
- A regular single click still places one caret at the clicked location.
- Selection stays inside the active Learning Archive editor.
- Existing keyboard selection and editor regression contracts pass.
