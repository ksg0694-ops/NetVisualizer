# Zero-base foundation — Design

- Add owner-only restrictive RLS guards to private tables; preserve existing grants/policies for compatibility but remove anonymous table grants. Existing owner IDs/data remain untouched.
- Live-schema review: banksalad_sync_runs is intentionally SELECT-only. Add no generic permissive owner-write policy; existing permissive policies remain the upper bound of access. Apply through Management API migrations with history, then run rollback-only synthetic verification.
- Central account storage facade with scoped keys. Legacy unscoped records remain recoverable, never automatically assigned to a new account. Account changes flush the previous scope and reload into the new scope, clearing in-memory state.
- Atomic portfolio RPC (security invoker) validates record ownership. Notes/todos use optimistic concurrency based on server updated_at, persisted base versions and conflict copies. Never fall back to unguarded overwrites if a migration is unavailable.
- Generated precache manifest follows actual HTML asset URLs. Cache local resources only, retain lazy assets on demand, restrict cache cleanup to this app. Bundle the SDK locally.
- Shared UI foundation owns auth/empty-state handling, modal focus and stale-on-resume refresh. Keep current feature layouts; mobile hides unused library panels, permits zoom, and has readable controls.
- Incremental structural work: extract shared persistence and account state; centralize bootstrap asset ordering, document feature ownership and focused checks. Retain existing domain modules.
- Verify with isolated storage/remote doubles, rollback-only database tests, full current checks and browser mobile/desktop observations. No private data in fixtures or GitHub artifacts.
