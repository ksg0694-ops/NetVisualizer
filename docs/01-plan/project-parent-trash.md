# Project deletion / restoration

## Plan / design
- Extend existing confirmed soft deletion to projects. Only parent flags change atomically with owner/version guard; child records are retained unchanged.
- All normal views and task archive/trash lists hide children of deleted projects. Project trash row shows retained child count and opens read-only restoration.
- Restoring parent makes originally active children visible again. Previously archived/deleted children remain archived/deleted; never resurrect individually deleted tasks.
- No hard deletion, finance changes or private data changes during implementation.

## Check gate
- Parent filtering and child-state preservation, project store ownership/conflict guard, schema constraint, browser delete/restore, full suite before deployment.

## Report
- Full npm check passed (67 tests). Parent version conflicts, owner-scoped updates, schema deleted/archived consistency and unchanged child records verified.
- Synthetic browser: deletion confirmation includes child count; deleted project disappears from filter and active lists; restore returns both active children. No private user records changed.
- Additive migration applied; release revision 075a136eb8c8f910. Screenshot outputs/project-delete-confirm.png is synthetic and ignored.
