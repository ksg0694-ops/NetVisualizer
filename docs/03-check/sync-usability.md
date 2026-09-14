# Sync usability — Check

- Existing synchronization retained; no new WebSocket subscription, polling loop or backend migration.
- Full npm run check passed, including behavior tests for conflict backup/adoption, stale comparisons, queued obsolete writes, remote deletion and >1000-row reads with failure on later pages.
- Browser synthetic fixture: comparison dialog renders server HTML-like content as plain text, explicit server adoption removes the pending conflict and shows backup confirmation. Fixture has no real account storage or remote connection.
- Shared paging replaces repeated unbounded Todo/Learning reads. Refresh is deferred on focused editors/inputs and open modals, including checks after network responses.
- User confirmed the prior foundation deployment works on 2026-09-14.

Limitations: one-click resolution adopts the server version only. Local revisions remain exportable; automatic merge or direct local-over-server overwrite is intentionally unavailable. Pagination is not a point-in-time database snapshot. Physical-device and real-account conflict UI acceptance are not claimed by synthetic tests.
