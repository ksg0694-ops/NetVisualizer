# Update 1.04.03 Learning Archive Drag Performance Check

## Automated checks

- `npm.cmd run check`: passed.
- `node --check js/features/learningArchive.js`: passed.
- `node tools/check-ui-contract.mjs`: passed.
- `git diff --check`: passed.

## Browser checks

- Learning Archive loaded with existing multi-note hierarchy.
- Alt+ArrowDown reordered a note immediately and Alt+ArrowUp restored it.
- Search reduced the tree to one matching note without replacing the active editor.
- Clearing search restored the complete two-note hierarchy.
- Switching notes retained the existing editor content and title.
- Final desktop layout remained aligned at the current production viewport.

## Regression contracts

- No dedicated drag handle was added.
- Ghost and placeholder visual classes are required.
- Pointer painting must remain animation-frame throttled.
- Search and reorder must retain tree-only rendering.
- Supabase order persistence must remain batched.
