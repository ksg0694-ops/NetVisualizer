# Update 1.04.03 Todo Unified Editor — Plan

## Goal

Make Todo detail notes behave like one continuous memo surface instead of isolated line editors.

## Scope

- Move `contenteditable` ownership from every note line to one parent surface.
- Preserve the line data model used for indentation and serialization.
- Preserve B/U/S, Enter, Backspace, Delete, Tab, autosave, versions, and stored notes.
- Add explicit caret movement across line boundaries.

## Quality gate

- One editing host and zero per-line editing hosts.
- Vertical and horizontal caret movement crosses lines.
- Full repository checks and browser regression checks pass.
