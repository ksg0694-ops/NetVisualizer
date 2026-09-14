# Change map — read this before scanning the repository

## Fast entry points

| Change | Primary files | Focused check |
|---|---|---|
| Auth / account transitions | js/features/appCore.js, js/shared/accountStorage.js | npm run check:foundation |
| Todo / Learning sync | js/shared/recordSync.js, js/features/checklist.js, js/features/learningArchive.js | npm run check:foundation |
| Conflict comparison / recovery | js/shared/conflictPanel.js, js/shared/recordSync.js | npm run check:foundation |
| Finance persistence / portfolio save | js/features/financeRepository.js, supabase/migrations | npm run check:repository |
| Finance calculations | src/domain, js/features/financeViews.js | npm run check:domain |
| Personal CFO | src/features/personal-cfo, js/features/personalCfo.js | npm run build:cfo-runtime && npm run check:cfo-runtime |
| Bootstrap / responsive UI | index.html, js/features/appShell.js, js/shared/appExperience.js, styles/foundation.css | npm run check:ui-contract |
| Offline delivery | tools/build-offline.mjs, sw.js | npm run build:offline && npm run check:foundation |

## Invariants

- Feature scripts still share legacy globals. This change isolates persistence; it is not a full framework rewrite.
- Read account data only through AccountStorage.current. Its scope never changes in the lifetime of a document. Auth switching flushes drafts and reloads; do not replace the facade while old requests are running.
- Do not automatically import unscoped local records into a newly signed-in account. Preserve original data and use the original-account backup control.
- Never adopt a newer server version as the base of an unsaved local edit. RecordSync writes require the prior server version; conflicts retain both copies.
- Explicit server-copy adoption must retain a resolved backup, validate the displayed local/server state and invalidate previously queued saves. Feature adapters own local replacement and dirty/trash queue cleanup. Shared readAllRows must complete all pages before merging.
- Portfolio save is one authenticated database transaction. No sequential-write fallback when the RPC is missing. Reuse an operation ID only for the exact same mutation.
- Generated files: styles/app.css, js/generated/*, vendor/supabase.js, offline-assets.js. Change sources, then run npm run check; never read or edit generated bundles by default.
- Refresh-on-resume is not a WebSocket subscription. Status is per dataset; partial failure must not advance the global success time.

## Low-context workflow

1. Read docs/.pdca-status.json and the relevant row above. Use rg with a narrow path/symbol before reading a complete file.
2. Read only the current plan/design and affected function; old PDCA history is under docs/archive.
3. Run the focused check while editing. Run npm run check once before delivery.
4. Review git diff --stat, then the scoped diff. Do not print generated assets or lockfiles in chat.
5. Batch related verified changes into one branch update. GitHub publication frequency alone does not guarantee token savings; avoiding repeated full scans/diffs is the main design here.

See docs/03-check/zero-base-foundation.md for verified coverage and the deployment gate.
