# Update 1.04.03 Learning Archive Text Selection Check

## Automated checks

- `npm.cmd run check`: passed.
- JavaScript syntax and UI runtime contracts: passed.
- `git diff --check`: passed.

## Browser checks

- Existing note opened in the shared multiline editor.
- Shift+Arrow selection removed multiple selected characters in one action, confirming a non-collapsed range.
- The note was restored from its existing version immediately after the destructive selection check.
- Final note content matched the pre-check text exactly.

## Regression contracts

- Click correction must call `preserveEditorTextSelection` before collapsing the caret.
- Pointer selection must clone the browser range at pointerup.
- A selected range must have both endpoints inside the active editor.
