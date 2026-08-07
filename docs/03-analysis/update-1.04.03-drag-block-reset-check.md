# Update 1.04.03 Drag Ordering / Block Reset Check

## Automated checks

- `npm.cmd run check`: passed
- JavaScript syntax: passed
- TypeScript: passed
- UI runtime contracts: passed
- Supabase column contracts: passed
- Static asset references: passed
- `git diff --check`: passed

## Interaction checks

- Todo heading converted to `일반 문단` without losing text: passed
- Applying the same heading block a second time reset it to a paragraph: passed
- Learning note moved above its sibling: passed
- Reordered note position remained after switching views: passed
- Learning hierarchy drag handles were visible in desktop and 390 px mobile layouts: passed

## Server check

Migration `20260808193000_learning_archive_ordering.sql` was dry-run, applied to the linked Supabase project, and confirmed in the remote migration ledger.
