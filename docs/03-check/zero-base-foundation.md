# Zero-base foundation — Check / handoff (2026-09-13)

## Implemented

- Account-scoped device storage, auth-transition draft flushing and document reset.
- Owner-only database policy migration; no remote data rewritten.
- Atomic/idempotent portfolio RPC and a client that refuses unsafe fallback.
- Todo/Learning optimistic concurrency, per-record save queues, recoverable conflict JSON exports, IME guards.
- Local Supabase SDK, exact-URL offline manifest, app-specific cache lifecycle, development SW isolation.
- Visible login entry, unknown-data state, zoom, mobile empty-library removal, login labels and focus handling.
- Per-table last successful refresh and refresh-on-resume/network restoration.
- Shared modules, change map, focused behavior tests and GitHub quality gates.

## Evidence

- npm run check: full build, syntax, TypeScript, repository/domain/CFO/monthly-close/forecast/UI/performance/schema/market/static checks passed locally.
- Foundation tests: account isolation, inter-device conflict preservation, stale delete protection, dirty-base preservation, same-device serialization, offline URLs; migrations executed in isolated PGlite PostgreSQL with ownership, rollback and duplicate-operation checks.
- Browser: fresh static origin on port 8081 renders the guest dashboard and login modal; at 390 x 844 the document width is 390, email receives focus and console warnings/errors are empty.
- Previous Vite origin had a stale service worker and blank auth-pending screen; fresh origin isolated the cause. Development registration cleanup and feature asset version bump added.
- Rechecked the existing Vite origin after the fix: auth-pending is cleared, dashboard rendered, console has no warnings/errors. Python mail-sync tests: 15 passed.
- Tests use synthetic records only. No private remote note content was downloaded, and no production test records were written.

## Deployment gate — NOT complete

The configured Supabase management credential returns HTTP 401. The three migrations are local only. The anonymous Learning Archive access found in the prior audit must be considered unresolved until remote verification succeeds. Do not merge/deploy the frontend before the RPC migration is applied: portfolio saves intentionally fail closed while the RPC is missing.

1. Restore Supabase management authentication locally; never paste credentials into chat or commit them.
2. Inspect live schema, grants, policies, triggers and relevant security-definer functions. Confirm each public user_id table is private; the owner-guard migration intentionally covers them all.
3. Apply migrations 20260912090000, 20260912091000, 20260912092000 in order using the normal migration workflow and record migration history. The maintenance query helper alone does not update Supabase migration history.
4. Verify anon rejection and cross-account isolation with controlled accounts; verify portfolio rollback/retry and note conflict with two sessions. Do not test writes on real financial records.
5. Merge the reviewed branch, wait for GitHub Pages, then npm run deploy:verify. Check an existing installed PWA after closing/reopening old tabs as well as a clean profile.

## Explicit remaining scope

- Conflict copies are exportable but there is no interactive merge/resolution screen yet.
- No push-based real-time subscription, guaranteed cross-device latency or comprehensive pagination redesign.
- No full global-state/module migration or removal of every legacy string-based contract test.
- Browser verification is not a physical iOS/Android device test. Offline launch with an expired account session and signed-in mobile flows need acceptance testing after backend access is restored.
- LocalStorage scope isolation is not encryption or protection against scripts/people with access to the same browser profile. Existing unscoped data is preserved, not deleted; its backup is restricted in the UI to the original account.
- Existing PPT dependency audit findings need a separate compatible upgrade; no forced major upgrade was applied.
