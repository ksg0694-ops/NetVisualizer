# Advanced Independent Note Suite — Check

## Automated verification

- `npm run check`: passed
- JavaScript syntax: passed
- TypeScript: passed
- UI, Supabase, manifest, domain, finance, and static-asset contracts: passed
- `git diff --check`: passed

## Live browser verification

- Learning template populated expected headings.
- Learning paragraph style persisted as `quote` after reload.
- Learning title/body search, recent navigation, and version comparison rendered correctly.
- Todo template populated expected headings.
- Todo paragraph style persisted as `quote` after reload.
- Todo search, recent sorting, and version diff rendered correctly.
- Markdown, Word, and PDF-print options are exposed in both independent editors.
- Temporary Todo and Learning Archive records were moved to their own trash and permanently removed.

## Independence check

Learning Archive contains no `ChecklistFeature`, related-Todo, related-Step, or conversion dependency. Todo does not read the Learning Archive store.
