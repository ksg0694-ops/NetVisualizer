# Update 1.04.03 Editor Stability Plan

## Problem

The Learning Archive rendered each note line as a separate contenteditable element. This prevented normal cross-line caret movement and made clicks resolve to the wrong line. Related keyboard, line merge, checklist, and live-count behavior was inconsistent.

## Goal

- Replace isolated line editors with one multiline editing host.
- Preserve the current rendered block design and serialized note format.
- Make mouse and keyboard editing deterministic across lines.
- Regress formatting, indentation, checklist, autosave, and explicit save.

## Acceptance Criteria

1. Clicking text places the caret on the clicked logical line.
2. ArrowUp/ArrowDown cross lines while preserving the text offset.
3. Home/End and line-boundary Left/Right work predictably.
4. Enter creates lines; Backspace and Delete merge them from either boundary.
5. Tab/Shift+Tab, bold formatting, checklist state, count, and saving remain functional.
