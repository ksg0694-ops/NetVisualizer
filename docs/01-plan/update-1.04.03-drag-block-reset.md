# Update 1.04.03 Drag Ordering / Block Reset Plan

## Goal

- Allow the Learning Archive hierarchy to be manually reordered.
- Allow a Todo note block to return to a normal paragraph after it is applied.
- Preserve existing local and Supabase data while adding the new behavior.

## Scope

- Learning Archive: field, item, Chapter, and note ordering inside the same parent.
- Todo editor: explicit `일반 문단` action and same-block toggle-off.
- Desktop drag interaction plus keyboard reorder fallback (`Alt+↑/↓`).
- Persistent local order and cross-device Supabase synchronization.

## Quality Gate

- Full repository check suite passes.
- Reorder survives a view rerender.
- Block reset preserves the line text.
- Desktop and 390 px mobile layouts remain usable.
