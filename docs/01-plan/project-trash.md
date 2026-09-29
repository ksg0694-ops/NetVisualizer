# Task deletion

## Plan / design
- Add explicit Delete in existing task editor, inline confirmation, and recoverable Tasks > Trash. Projects remain archive-only.
- Soft-delete uses deleted boolean plus archived=true for compatibility with older clients. Restore returns task to active status; archived parent projects remain archived.
- Update only deletion flags with owner/id/version guards; never save unsaved editor changes during deletion. No permanent-delete grant or personal record deletion during development.

## Check gate
- Deleted items excluded from all totals/calendar; migration constraint and version conflicts; browser cancel/delete/restore; full regression suite and verified release.

## Check / report
- Full npm check passed (66 tests). Local PostgreSQL migration constraint, delete/restore and existing RLS tests passed; store tests cover ownership, stale version, offline failure and account switch.
- Synthetic browser verified confirmation cancellation, removal from active list, read-only trash details and successful restore. No real user task deleted.
- Additive migration applied. No new hard-delete permission. Screenshot outputs/project-trash-qa.png is synthetic and ignored by git.
- Release revision 3bfa1b44e3878d42.
