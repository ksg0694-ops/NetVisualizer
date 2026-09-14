# Sync usability — Design

- RecordSync owns conflict enumeration, refreshed comparison, serialized server-copy adoption, resolved backups and per-record generation invalidation. Feature adapters expose local payload snapshots and atomic local adoption/dirty-queue cleanup.
- Settings contains a native dialog with text-only comparison. Explicit server-copy adoption never writes to the database. Latest server version and latest local snapshot must still match the comparison. Keep the discarded local copy in account-scoped recovery history.
- Shared readAllRows pages deterministic ID-ordered reads; any error aborts merging. Snapshot pagination is not a database transaction; simultaneous inserts/deletes may require the next refresh.
- Refresh must defer while an editor/input/modal is active; record pending work and retry on focusout rather than losing the refresh request. No polling/WebSocket or new backend migration is needed for these changes.
