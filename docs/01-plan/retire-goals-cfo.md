# Retire long-term goals and Personal CFO

## Plan / design
- Remove both desktop/mobile menu entries and retire their routes; stale persisted routes fall back to Cash Flow.
- Preserve historical asset records used by My Assets, all cloud data, and shared finance domain calculations used by Monthly Report.
- Keep legacy markup inert/hidden to avoid breaking shared DOM dependencies; stop loading the standalone CFO feature.

## Do / check
- Removed navigation, registered views, context titles, restore allowlist entries and CFO feature script.
- Extended navigation/restore regression tests and UI contracts; run full project check before batch deployment.

## Report gate
- Push only application changes; do not delete user records. Verify deployed revision matches local build.
- Check complete: all 57 regression tests and full project check passed. Historical assets continue loading through the unchanged repository; no database write occurred.
