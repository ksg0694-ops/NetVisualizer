# Update 1.04.03 Todo Unified Editor — Design

## Root cause

Each Todo note line owned a separate `contenteditable` element. Browser selection and caret navigation therefore stopped at line boundaries.

## Design

- The parent note surface is the only `contenteditable` host.
- Line and content elements remain structural children without independent editing ownership.
- Selection-derived helpers resolve the active line and text offset.
- Arrow, Home, End, Enter, Backspace, Delete, and Tab operate against the shared selection.
- Existing serialization continues writing the same newline-delimited note string.

## Data safety

No schema or stored-note migration is required.
