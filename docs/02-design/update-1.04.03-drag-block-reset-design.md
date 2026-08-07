# Update 1.04.03 Drag Ordering / Block Reset Design

## Learning Archive ordering

Each note stores four independent order values:

- `field_order`
- `item_order`
- `chapter_order`
- `display_order`

The tree is still derived from note records, but each hierarchy level now sorts by its stored order. A drop is accepted only between nodes at the same level with the same parent. Reordering a group updates every note that belongs to that group so the derived tree remains deterministic.

The client falls back to the legacy Supabase column contract when the migration is not yet available. Local ordering therefore remains usable during rollout.

## Todo block reset

`일반 문단` is the canonical neutral block. Converting a heading, checkbox, callout, divider, or table row to this block removes its structural prefix while preserving visible text. Selecting the currently active block type again resolves to the same paragraph reset action.

## Accessibility

Every drag handle is keyboard-focusable. `Alt+ArrowUp` and `Alt+ArrowDown` call the same reorder path used by drag-and-drop.
