# Card management

## Plan / design
- Existing cards table remains authoritative; add editor for name, issuer, credit/debit/unspecified, active/closed, purpose, billing day, annual fee, spending requirement, benefits, issue date and memo.
- No card number/CVC/password fields. Preserve existing images and picking-rate fields on partial edits. Blank amounts mean unknown; zero is explicitly none.
- Isolated paged owner-scoped reads, version-guarded partial writes, account switch invalidation; unique creation token prevents duplicate retry insert. Recoverable soft-delete, not permanent deletion.
- Native dialog above settings with inline confirmation/error. Insurance unchanged. Schema additive, existing user data not reclassified or deleted.

## Check gate
- Validation, owner/version/error guards, migration constraints/legacy preservation; synthetic browser create/edit/delete/restore; full suite then deploy.

## Report
- Full npm check passed (72 tests). Local SQL preserves images/picking rates, rejects bad enums/day, protects identities/version and duplicate creation token. Existing owner RLS and authenticated sequence access inspected; unchanged.
- Synthetic browser verified create with unknown vs zero fees, edit to closed, soft-delete and restore preserving closed state; 390px modal has no document overflow. No real card edited or deleted.
- Additive database migration applied. Screenshot outputs/card-editor-qa.png is synthetic and ignored. Release revision 2a2aad9bc0618d3f.
