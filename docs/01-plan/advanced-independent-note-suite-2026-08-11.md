# Advanced Independent Note Suite — Plan

## Goal

Make Todo and Learning Archive feel like dependable note applications while keeping their records, navigation, trash, and synchronization completely separate.

## Scope

- Flexible inline font sizing and lightweight paragraph styles
- Format reset, templates, search, recent navigation, and version comparison
- Markdown, Word, and PDF-print export
- Device-first saving with safe remote reconciliation and queued deletion
- No Todo-to-Learning or Learning-to-Todo relationship

## Acceptance criteria

- Formatting and paragraph styles survive save and reload.
- Each feature searches and sorts only its own records.
- Unsynced local edits win over a remote refresh until successfully uploaded.
- Trashed or permanently deleted records cannot be resurrected by remote refresh.
- Full automated checks and live desktop interaction checks pass.
