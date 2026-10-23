# Owner-only on-demand BankSalad collection

The frontend never receives a GitHub token, Gmail OAuth credential, ZIP password or service-role key. The broker validates the user's Supabase session with `auth.getUser(token)` and checks the configured owner, then dispatches only the fixed `ksg0694-ops/NetVisualizer` main-branch mail workflow. Browser request bodies cannot choose a workflow, ref, owner or Gmail query.

## Required rollout

1. Merge the workflow and worker changes. Existing scheduled imports remain compatible and continue every 15 minutes.
2. Apply `supabase/migrations/20261023121459_banksalad_sync_requests.sql` to the existing project. This creates only a request table and service-only enqueue RPC; it does not alter transactions.
3. Set these **Supabase Edge Function secrets**, never frontend settings:
   - `NETVISUALIZER_OWNER_USER_ID`: same owner UUID already used by the existing GitHub workflow.
   - `BANKSALAD_GITHUB_ACTIONS_TOKEN`: fine-grained GitHub token limited to this repository with **Actions: Read and write**. Set an expiry and rotate it before expiry. No Contents-write permission is required.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the Supabase runtime.
4. Deploy `request-banksalad-sync` with its `handler.ts` using the checked-in function config (`verify_jwt=true`). The gateway and handler both verify the user's session; the handler additionally checks the configured owner.
5. Verify anonymous access returns 401, a different user returns 403, and the owner receives 202 with a request UUID. Poll that owner's `banksalad_sync_requests` row to terminal status, then check Gmail import provenance and transaction counts. No raw attachment data should appear in logs.
6. Deploy the frontend only after a real owner request completes. In an existing PWA use Settings → app update to load the new build.

GitHub runner startup/queue time is included in the visible wait. The frontend polls at three-second intervals for three minutes, then reports that collection is still pending. It never cancels the import on timeout. Click again to join the active request. Completed empty checks mean no additional transactions; overlapping exports are still deduplicated by the existing importer. Mail must have arrived before the worker's Gmail query runs; if it arrives later, click again after arrival (minimum 30 seconds between new requests).

The request is marked failed on workflow/import failure. A cancelled job or infrastructure failure can leave an active request; enqueue expires it after 20 minutes. The existing scheduled importer remains a fallback. The workflow-wide concurrency group serializes scheduled and requested imports; many simultaneous pending GitHub dispatches may replace a pending run, which is surfaced as a request timeout rather than false completion.

## Verification

```sh
node --test tools/tests/banksalad-sync.test.mjs
python -m unittest discover -s tools/tests -p 'test_*.py' -v
npm run check
```

## Rollback

Revert the frontend button binding to database refresh, remove/disable the broker, and revoke the Actions token. Keep the additive request table for audit or remove it in a separate reviewed migration. Do not remove transaction history or change the existing scheduled importer.

References: [GitHub workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
