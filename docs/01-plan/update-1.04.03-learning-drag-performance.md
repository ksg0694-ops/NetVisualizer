# Update 1.04.03 Learning Archive Drag Performance Plan

## Goal

- Make Learning Archive hierarchy reordering feel as immediate as Todo reordering.
- Show the moving row and the exact insertion position before drop.
- Remove unnecessary full-workbench rendering and repeated server writes.

## Scope

- Field, item, Chapter, and note long-press reordering.
- Tree search, note switching, editor input scheduling, and order persistence.
- Desktop and touch activation timing without reintroducing visible drag handles.

## Acceptance criteria

- Desktop drag activates after a short 180 ms hold and touch after 260 ms.
- A floating ghost and dashed insertion placeholder remain visible while moving.
- Drag painting runs at most once per animation frame.
- Search and reorder update only the hierarchy tree.
- Reordered rows are sent to Supabase in one batch.
